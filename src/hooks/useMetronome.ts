import { useEffect, useRef, useState } from 'react';
import { MetronomeEngine, type EngineStatus } from '../audio/metronomeEngine';
import type { TimelineBeat } from '../audio/beatTimeline';
import type { Song } from '../types';

export function useMetronome(song: Song) {
  const [status, setStatus] = useState<EngineStatus>('stopped');
  const [beat, setBeat] = useState<TimelineBeat | null>(null);
  const engineRef = useRef<MetronomeEngine | null>(null);

  if (!engineRef.current) {
    engineRef.current = new MetronomeEngine({
      onBeat: setBeat,
      onStatusChange: setStatus,
      onSongEnd: () => {},
    });
  }

  useEffect(() => {
    const engine = engineRef.current!;
    engine.loadSong(song);
    setBeat(engine.getFirstRealBeat() ?? null);
    setStatus('stopped');
    return () => engine.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [song]);

  useEffect(() => {
    const engine = engineRef.current!;
    return () => engine.dispose();
  }, []);

  const timeline = engineRef.current.getTimeline();

  return {
    status,
    beat: beat ?? engineRef.current.getFirstRealBeat() ?? null,
    timeline,
    play: () => engineRef.current!.play(),
    pause: () => engineRef.current!.pause(),
    stop: () => engineRef.current!.stop(),
    jumpToPart: (partIndex: number) => engineRef.current!.jumpToPart(partIndex),
    setClickVolume: (v: number) => engineRef.current!.setClickVolume(v),
    setVoiceEnabled: (v: boolean) => engineRef.current!.setVoiceEnabled(v),
  };
}
