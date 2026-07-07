import { buildCountInBeats, buildTimeline, type TimelineBeat } from './beatTimeline';
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
  beat: TimelineBeat;
  time: number;
  /** Index into `this.timeline` to adopt as `currentBeatIndex` once this note's
   * audio time arrives, or null for a virtual count-in beat (jump pre-roll)
   * that isn't part of the timeline. */
  realIndex: number | null;
}

export class MetronomeEngine {
  private ctx: AudioContext | null = null;
  private timeline: TimelineBeat[] = [];
  private bpm = 120;

  private status: EngineStatus = 'stopped';
  private currentBeatIndex = 0;
  private nextBeatIndex = 0;
  private nextNoteTime = 0;

  private schedulerTimerId: number | null = null;
  private rafId: number | null = null;
  private scheduledNotes: ScheduledNote[] = [];
  /** Virtual count-in beats to schedule before resuming from `nextBeatIndex`,
   * used when jumping to a part so it gets its own announcement + count-in
   * even though nothing in the timeline precedes it. */
  private pendingPrefix: TimelineBeat[] = [];
  private pendingOscillators: OscillatorNode[] = [];
  private pendingSampleSources: AudioBufferSourceNode[] = [];
  private pendingSpeechTimeouts: number[] = [];

  private clickVolume = 1;
  private voiceEnabled = true;
  private callbacks: MetronomeCallbacks;

  /** "Un/deux/trois/quatre" spoken samples for the count-in, indexed 0-3. */
  private countSamples: (AudioBuffer | null)[] = [];
  private countSamplesRequested = false;

  /** Bumped on every jumpToPart/play/pause/stop so a stale "announcement
   * finished" callback from a superseded jump can't start a count-in after
   * the user has since paused, stopped, or jumped elsewhere. */
  private jumpGeneration = 0;

  constructor(callbacks: MetronomeCallbacks) {
    this.callbacks = callbacks;
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

  /** Lazily creates the AudioContext on first use, always from within a real
   * user gesture (play() is only ever called from a click handler) so it
   * starts running immediately — creating it any earlier leaves it stuck
   * "suspended" on some browsers even after resume(), which silently freezes
   * ctx.currentTime and blocks all scheduling. Also kicks off decoding the
   * count-in samples on this same context the first time, since some
   * browsers (notably WebKit/Safari) won't reliably play an AudioBuffer
   * decoded on a different context. */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (!this.countSamplesRequested) {
      this.countSamplesRequested = true;
      void loadCountSamples(this.ctx).then((samples) => {
        this.countSamples = samples;
      });
    }
    return this.ctx;
  }

  /** Starts (or resumes) playback. Defaults to resuming from the last known position. */
  play(fromBeatIndex?: number): void {
    if (this.timeline.length === 0) return;
    this.jumpGeneration++;
    const ctx = this.ensureContext();
    const startIndex = Math.min(
      Math.max(fromBeatIndex ?? this.currentBeatIndex, 0),
      this.timeline.length - 1
    );
    this.currentBeatIndex = startIndex;
    this.nextBeatIndex = startIndex;
    this.nextNoteTime = ctx.currentTime + START_DELAY_S;
    this.scheduledNotes = [];
    this.pendingPrefix = [];

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
    this.jumpGeneration++;
    this.clearTimers();
    this.cancelPendingAudio();
    this.status = 'paused';
    this.callbacks.onStatusChange('paused');
  }

  stop(): void {
    this.jumpGeneration++;
    this.clearTimers();
    this.cancelPendingAudio();
    this.currentBeatIndex = 0;
    this.nextBeatIndex = 0;
    this.scheduledNotes = [];
    this.pendingPrefix = [];
    this.status = 'stopped';
    this.callbacks.onStatusChange('stopped');
    const firstBeat = this.getFirstRealBeat();
    if (firstBeat) this.callbacks.onBeat(firstBeat);
  }

  /** Jumps to the first beat of the given part index (0-based), for rehearsing
   * a specific section without replaying the whole song. Speaks the part's
   * name up front and, only once that finishes, plays a fresh count-in before
   * landing on its first beat — regardless of prior playback state — so the
   * musician gets a clear spoken cue followed by a clean lead-in to come in
   * with the click, rather than the name overlapping the count-in. */
  jumpToPart(partIndex: number): void {
    const idx = this.timeline.findIndex((b) => b.partIndex === partIndex);
    if (idx === -1) return;
    const target = this.timeline[idx];
    const ctx = this.ensureContext();

    this.clearTimers();
    this.cancelPendingAudio();
    this.scheduledNotes = [];
    this.pendingPrefix = [];
    this.currentBeatIndex = idx;
    this.nextBeatIndex = idx;

    this.status = 'playing';
    this.callbacks.onStatusChange('playing');

    const generation = ++this.jumpGeneration;
    // Shown immediately while the name is (maybe) being spoken, before the
    // count-in's own beats start arriving via onBeat — beatInMeasure -1 so no
    // beat dot lights up yet.
    this.callbacks.onBeat({
      globalIndex: -1,
      partIndex: -1,
      partName: '',
      measureInPart: -1,
      totalMeasuresInPart: 0,
      beatInMeasure: -1,
      beatsPerMeasure: target.beatsPerMeasure,
      accent: false,
      countInNumber: null,
      upcomingPartName: target.partName || null,
      announceUpcomingPart: false,
      isPreRoll: true,
    });

    const startCountIn = (): void => {
      // A later jump/play/pause/stop has since superseded this announcement.
      if (generation !== this.jumpGeneration) return;
      this.nextNoteTime = ctx.currentTime + START_DELAY_S;
      this.pendingPrefix = buildCountInBeats(target.beatsPerMeasure, target.partName || null, false);
      this.callbacks.onBeat(this.pendingPrefix[0]);
      this.runScheduler();
      this.runUiLoop();
    };

    if (this.voiceEnabled && target.partName !== '') {
      speak(target.partName, startCountIn);
    } else {
      startCountIn();
    }
  }

  dispose(): void {
    this.stop();
    void this.ctx?.close();
    this.ctx = null;
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
    const ctx = this.ctx!;
    while (this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_S) {
      let beat: TimelineBeat;
      let realIndex: number | null;
      if (this.pendingPrefix.length > 0) {
        beat = this.pendingPrefix.shift()!;
        realIndex = null;
      } else if (this.nextBeatIndex < this.timeline.length) {
        beat = this.timeline[this.nextBeatIndex];
        realIndex = this.nextBeatIndex;
        this.nextBeatIndex++;
      } else {
        break;
      }
      this.scheduleBeat(beat, this.nextNoteTime, realIndex);
      this.nextNoteTime += 60 / this.bpm;
    }
    if (this.nextBeatIndex < this.timeline.length || this.pendingPrefix.length > 0) {
      this.schedulerTimerId = window.setTimeout(this.runScheduler, LOOKAHEAD_MS);
    }
  };

  private scheduleBeat(beat: TimelineBeat, time: number, realIndex: number | null): void {
    if (
      beat.countInNumber === 1 &&
      this.voiceEnabled &&
      beat.upcomingPartName &&
      beat.announceUpcomingPart
    ) {
      // Free-text part names have no pre-recorded sample, so this one beat
      // falls back to speechSynthesis instead of the "un" sample — replacing
      // it entirely rather than layering both, same as the previous
      // TTS-only count-in used to do for this beat.
      this.announcePart(beat.upcomingPartName, time);
    } else if (beat.countInNumber !== null && this.voiceEnabled) {
      // Sample-accurate, same as the click: a real recorded voice saying
      // "un/deux/trois/quatre" scheduled directly on the audio graph, with
      // none of speechSynthesis's queuing or engine-startup latency. Cut off
      // at the next beat so a long recording can't bleed into it — these
      // samples (1.5-4.8s) far outlast a beat at rehearsal tempos.
      this.playCountSample(time, beat.countInNumber, time + 60 / this.bpm);
    } else {
      this.playClick(time, beat.accent);
    }
    this.scheduledNotes.push({ beat, time, realIndex });
  }

  /** Speaks the upcoming part name at (approximately) its scheduled beat
   * time. Scheduled via a plain timeout rather than the audio graph since
   * speechSynthesis has no sample-accurate API — acceptable here because
   * this fires at most once per count-in, unlike the digit samples which
   * need tight per-beat sync. */
  private announcePart(partName: string, time: number): void {
    const ctx = this.ctx!;
    const delayMs = Math.max(0, (time - ctx.currentTime) * 1000);
    const timeoutId = window.setTimeout(() => {
      this.pendingSpeechTimeouts = this.pendingSpeechTimeouts.filter((id) => id !== timeoutId);
      cancelSpeech();
      speak(partName);
    }, delayMs);
    this.pendingSpeechTimeouts.push(timeoutId);
  }

  private playCountSample(time: number, countInNumber: number, cutoffTime: number): void {
    const ctx = this.ctx!;
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
    const ctx = this.ctx!;
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
      const ctx = this.ctx!;
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
        if (note.realIndex !== null) this.currentBeatIndex = note.realIndex;
        this.callbacks.onBeat(note.beat);
      }

      if (this.status !== 'playing') return;

      const finishedScheduling =
        this.nextBeatIndex >= this.timeline.length && this.pendingPrefix.length === 0;
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
