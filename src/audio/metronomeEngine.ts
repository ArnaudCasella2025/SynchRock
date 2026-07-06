import { buildTimeline, type TimelineBeat } from './beatTimeline';
import { loadCountSamples } from './countSamples';
import { cancelSpeech, speak } from './speech';
import type { Song } from '../types';

export type EngineStatus = 'stopped' | 'playing' | 'paused';

export interface MetronomeCallbacks {
  /** Fired when a beat actually plays (i.e. its scheduled audio time has arrived). */
  onBeat: (beat: TimelineBeat) => void;
  onStatusChange: (status: EngineStatus) => void;
  onSongEnd: () => void;
}

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;
const CLICK_DURATION_S = 0.05;
const START_DELAY_S = 0.12;
const SAMPLE_FADE_OUT_S = 0.03;

interface ScheduledNote {
  index: number;
  time: number;
}

export class MetronomeEngine {
  private ctx: AudioContext;
  private timeline: TimelineBeat[] = [];
  private bpm = 120;

  private status: EngineStatus = 'stopped';
  private currentBeatIndex = 0;
  private nextBeatIndex = 0;
  private nextNoteTime = 0;

  private schedulerTimerId: number | null = null;
  private rafId: number | null = null;
  private scheduledNotes: ScheduledNote[] = [];
  private pendingOscillators: OscillatorNode[] = [];
  private pendingSampleSources: AudioBufferSourceNode[] = [];
  private pendingSpeechTimeouts: number[] = [];

  private clickVolume = 1;
  private voiceEnabled = true;
  private callbacks: MetronomeCallbacks;

  /** "Un/deux/trois/quatre" spoken samples for the count-in, indexed 0-3.
   * Fetched and decoded as soon as the engine is created (no user gesture
   * needed for that), so they're ready well before playback can start. */
  private countSamples: (AudioBuffer | null)[] = [];

  constructor(callbacks: MetronomeCallbacks) {
    this.callbacks = callbacks;
    // Created eagerly (constructing doesn't need a user gesture, only
    // resuming it for actual output does — see ensureContext) so decoding
    // and playback always share the same context.
    this.ctx = new AudioContext();
    void loadCountSamples(this.ctx).then((samples) => {
      this.countSamples = samples;
    });
  }

  loadSong(song: Song): void {
    this.stop();
    this.timeline = buildTimeline(song);
    this.bpm = song.bpm;
  }

  getTimeline(): TimelineBeat[] {
    return this.timeline;
  }

  /** First beat of real song content, skipping the pre-roll count-in — used to
   * display a sensible "ready to play" state rather than the pre-roll itself. */
  getFirstRealBeat(): TimelineBeat | undefined {
    return this.timeline.find((b) => !b.isPreRoll) ?? this.timeline[0];
  }

  getStatus(): EngineStatus {
    return this.status;
  }

  setClickVolume(v: number): void {
    this.clickVolume = v;
  }

  setVoiceEnabled(v: boolean): void {
    this.voiceEnabled = v;
    if (!v) cancelSpeech();
  }

  /** Starts (or resumes) playback. Defaults to resuming from the last known position. */
  play(fromBeatIndex?: number): void {
    if (this.timeline.length === 0) return;
    // The context is created eagerly (see constructor) so it can start
    // decoding samples before any user gesture, which means it's still
    // "suspended" the first time this runs from a real click. resume() must
    // be *called* synchronously from within this gesture to be honored by
    // the browser, but it completes asynchronously — ctx.currentTime stays
    // frozen at 0 until it does, so scheduling has to wait for it too.
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().then(() => this.beginPlayback(fromBeatIndex));
    } else {
      this.beginPlayback(fromBeatIndex);
    }
  }

  private beginPlayback(fromBeatIndex?: number): void {
    const ctx = this.ctx;
    const startIndex = Math.min(
      Math.max(fromBeatIndex ?? this.currentBeatIndex, 0),
      this.timeline.length - 1
    );
    this.currentBeatIndex = startIndex;
    this.nextBeatIndex = startIndex;
    this.nextNoteTime = ctx.currentTime + START_DELAY_S;
    this.scheduledNotes = [];

    this.status = 'playing';
    this.callbacks.onStatusChange('playing');

    const beat = this.timeline[startIndex];
    // Announce the part being landed on directly (resume/jump); the pre-roll
    // and part-transition count-ins are pure click cues for now, see scheduleBeat.
    if (this.voiceEnabled && startIndex !== 0 && beat.partName !== '') {
      cancelSpeech();
      speak(beat.partName);
    }
    this.callbacks.onBeat(beat);

    this.runScheduler();
    this.runUiLoop();
  }

  pause(): void {
    if (this.status !== 'playing') return;
    this.clearTimers();
    this.cancelPendingAudio();
    this.status = 'paused';
    this.callbacks.onStatusChange('paused');
  }

  stop(): void {
    this.clearTimers();
    this.cancelPendingAudio();
    this.currentBeatIndex = 0;
    this.nextBeatIndex = 0;
    this.scheduledNotes = [];
    this.status = 'stopped';
    this.callbacks.onStatusChange('stopped');
    const firstBeat = this.getFirstRealBeat();
    if (firstBeat) this.callbacks.onBeat(firstBeat);
  }

  /** Jumps directly to the first beat of the given part index (0-based), useful
   * for rehearsing a specific section without replaying the whole song. */
  jumpToPart(partIndex: number): void {
    const idx = this.timeline.findIndex((b) => b.partIndex === partIndex);
    if (idx === -1) return;
    const wasPlaying = this.status === 'playing';
    this.clearTimers();
    this.cancelPendingAudio();
    this.scheduledNotes = [];
    this.currentBeatIndex = idx;
    this.nextBeatIndex = idx;
    if (wasPlaying) {
      this.play(idx);
    } else {
      this.callbacks.onBeat(this.timeline[idx]);
    }
  }

  dispose(): void {
    this.stop();
    void this.ctx.close();
  }

  private clearTimers(): void {
    if (this.schedulerTimerId !== null) {
      window.clearTimeout(this.schedulerTimerId);
      this.schedulerTimerId = null;
    }
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private cancelPendingAudio(): void {
    cancelSpeech();
    this.pendingSpeechTimeouts.forEach((id) => window.clearTimeout(id));
    this.pendingSpeechTimeouts = [];
    this.pendingOscillators.forEach((osc) => {
      try {
        osc.stop();
      } catch {
        // already stopped
      }
    });
    this.pendingOscillators = [];
    this.pendingSampleSources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    });
    this.pendingSampleSources = [];
  }

  private runScheduler = (): void => {
    const ctx = this.ctx;
    while (
      this.nextBeatIndex < this.timeline.length &&
      this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_S
    ) {
      this.scheduleBeat(this.nextBeatIndex, this.nextNoteTime);
      this.nextNoteTime += 60 / this.bpm;
      this.nextBeatIndex++;
    }
    if (this.nextBeatIndex < this.timeline.length) {
      this.schedulerTimerId = window.setTimeout(this.runScheduler, LOOKAHEAD_MS);
    }
  };

  private scheduleBeat(index: number, time: number): void {
    const beat = this.timeline[index];
    if (beat.countInNumber !== null && this.voiceEnabled) {
      // Sample-accurate, same as the click: a real recorded voice saying
      // "un/deux/trois/quatre" scheduled directly on the audio graph, with
      // none of speechSynthesis's queuing or engine-startup latency. Cut off
      // at the next beat so a long recording can't bleed into it — these
      // samples (1.5-4.8s) far outlast a beat at rehearsal tempos.
      this.playCountSample(time, beat.countInNumber, time + 60 / this.bpm);
    } else {
      this.playClick(time, beat.accent);
    }
    this.scheduledNotes.push({ index, time });
  }

  private playCountSample(time: number, countInNumber: number, cutoffTime: number): void {
    const ctx = this.ctx;
    const buffer = this.countSamples[countInNumber - 1];
    if (!buffer) {
      // Not loaded (slow network) or failed to decode — a click beats silence.
      this.playClick(time, countInNumber === 1);
      return;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    source.connect(gain);

    gain.gain.setValueAtTime(this.clickVolume, time);
    source.start(time);
    if (time + buffer.duration > cutoffTime) {
      // Fade out fast right before the cutoff instead of stopping cold, to
      // avoid an audible click/pop from truncating a non-zero waveform.
      // Must come after start() — the spec throws if stop() is scheduled
      // before the node has actually been started.
      const fadeStart = Math.max(time, cutoffTime - SAMPLE_FADE_OUT_S);
      gain.gain.setValueAtTime(this.clickVolume, fadeStart);
      gain.gain.linearRampToValueAtTime(0.0001, cutoffTime);
      source.stop(cutoffTime + 0.01);
    }

    this.pendingSampleSources.push(source);
    source.onended = () => {
      this.pendingSampleSources = this.pendingSampleSources.filter((s) => s !== source);
    };
  }

  private playClick(time: number, accent: boolean): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = accent ? 1500 : 1000;
    osc.connect(gain);
    gain.connect(ctx.destination);

    const peak = (accent ? 1 : 0.6) * this.clickVolume;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + CLICK_DURATION_S);

    osc.start(time);
    osc.stop(time + CLICK_DURATION_S + 0.01);

    this.pendingOscillators.push(osc);
    osc.onended = () => {
      this.pendingOscillators = this.pendingOscillators.filter((o) => o !== osc);
    };
  }

  private runUiLoop(): void {
    const tick = (): void => {
      const ctx = this.ctx;
      // outputLatency (or the older baseLatency) is the browser's own estimate
      // of the delay between a sample leaving the audio graph and it actually
      // reaching the speaker. Holding the UI update back by that amount keeps
      // the on-screen part/measure closer to what's actually audible instead
      // of jumping to the next part before its click has really been heard.
      // This can't account for latency further downstream (e.g. a Bluetooth
      // speaker's own radio/codec delay), which the browser has no way to see.
      const outputLatency = ctx.outputLatency ?? ctx.baseLatency ?? 0;
      const now = ctx.currentTime - outputLatency;

      while (this.scheduledNotes.length && this.scheduledNotes[0].time <= now) {
        const note = this.scheduledNotes.shift()!;
        this.currentBeatIndex = note.index;
        this.callbacks.onBeat(this.timeline[note.index]);
      }

      if (this.status !== 'playing') return;

      const finishedScheduling = this.nextBeatIndex >= this.timeline.length;
      if (finishedScheduling && this.scheduledNotes.length === 0) {
        this.status = 'stopped';
        this.currentBeatIndex = 0;
        this.nextBeatIndex = 0;
        this.callbacks.onStatusChange('stopped');
        const firstBeat = this.getFirstRealBeat();
        if (firstBeat) this.callbacks.onBeat(firstBeat);
        this.callbacks.onSongEnd();
        return;
      }

      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }
}
