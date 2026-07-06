import { buildTimeline, type TimelineBeat } from './beatTimeline';
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

interface ScheduledNote {
  index: number;
  time: number;
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
  private pendingOscillators: OscillatorNode[] = [];
  private pendingSpeechTimeouts: number[] = [];

  private clickVolume = 1;
  private voiceEnabled = true;
  private callbacks: MetronomeCallbacks;

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

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /** Starts (or resumes) playback. Defaults to resuming from the last known position. */
  play(fromBeatIndex?: number): void {
    if (this.timeline.length === 0) return;
    const ctx = this.ensureContext();

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
  }

  private runScheduler = (): void => {
    const ctx = this.ctx!;
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
    // Diagnostic: the last measure of every part (and the pre-roll) used to be
    // spoken ("Refrain, 2, 3, 4") on every beat, but that put heavy, repeated
    // load on the browser's speech engine. Testing whether that's the actual
    // cause of the drift/dropped-click reports by replacing it with a purely
    // audio cue instead — a deeper-pitched click, no speech synthesis at all.
    this.playClick(time, beat.accent, beat.countInNumber !== null);
    this.scheduledNotes.push({ index, time });
  }

  private playClick(time: number, accent: boolean, lowPitch: boolean): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = lowPitch ? (accent ? 700 : 500) : accent ? 1500 : 1000;
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
      const now = ctx.currentTime;

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
