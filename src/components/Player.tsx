import { useState } from 'react';
import { useMetronome } from '../hooks/useMetronome';
import { isSpeechSupported } from '../audio/speech';
import type { Song } from '../types';

interface Props {
  song: Song;
  onBack: () => void;
}

export function Player({ song, onBack }: Props) {
  const { status, beat, play, pause, stop, jumpToPart, setClickVolume, setVoiceEnabled } =
    useMetronome(song);
  const [volume, setVolume] = useState(1);
  const [voiceOn, setVoiceOn] = useState(true);

  if (!beat) {
    return (
      <div className="player">
        <button type="button" className="back-btn" onClick={onBack}>
          &larr; Retour
        </button>
        <p className="hint">Cette chanson n'a aucune partie.</p>
      </div>
    );
  }

  const nextPart = song.parts[beat.partIndex + 1] ?? null;
  const isLastPart = beat.partIndex === song.parts.length - 1;
  const measuresLeftInPart = beat.totalMeasuresInPart - beat.measureInPart - 1;

  function handleVolumeChange(v: number) {
    setVolume(v);
    setClickVolume(v);
  }

  function handleVoiceToggle(on: boolean) {
    setVoiceOn(on);
    setVoiceEnabled(on);
  }

  return (
    <div className="player">
      <header className="player-header">
        <button type="button" className="back-btn" onClick={onBack}>
          &larr; Retour
        </button>
        <div className="player-title">
          <h1>{song.titre}</h1>
          <span className="subtitle">{song.bpm} BPM</span>
        </div>
      </header>

      <div className="part-display">
        <span className="part-progress">
          Partie {beat.partIndex + 1} / {song.parts.length}
        </span>
        <h2 className="part-name">{beat.partName}</h2>
        <span className="measure-progress">
          Mesure {beat.measureInPart + 1} / {beat.totalMeasuresInPart}
        </span>
        <p className="next-part">
          {isLastPart
            ? 'Dernière partie'
            : `Suivant : ${nextPart?.partName} ${measuresLeftInPart > 0 ? `(dans ${measuresLeftInPart} mesure${measuresLeftInPart > 1 ? 's' : ''})` : ''}`}
        </p>
      </div>

      <div className="beat-dots" role="presentation">
        {Array.from({ length: beat.beatsPerMeasure }).map((_, i) => (
          <span
            key={i}
            className={
              'beat-dot' +
              (i === 0 ? ' accent' : '') +
              (i === beat.beatInMeasure ? ' active' : '')
            }
          />
        ))}
      </div>

      <div className="transport">
        {status === 'playing' ? (
          <button type="button" className="primary big" onClick={pause}>
            ⏸ Pause
          </button>
        ) : (
          <button type="button" className="primary big" onClick={play}>
            ▶ {status === 'paused' ? 'Reprendre' : 'Jouer'}
          </button>
        )}
        <button type="button" className="secondary big" onClick={stop}>
          ⏹ Stop
        </button>
      </div>

      <div className="settings-row">
        <label className="volume-control">
          Volume clic
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
          />
        </label>
        <label className="voice-control">
          <input
            type="checkbox"
            checked={voiceOn}
            disabled={!isSpeechSupported()}
            onChange={(e) => handleVoiceToggle(e.target.checked)}
          />
          Annonce vocale des parties
          {!isSpeechSupported() && <span className="hint"> (non supportée par ce navigateur)</span>}
        </label>
      </div>

      <ol className="part-list">
        {song.parts.map((part, index) => (
          <li
            key={`${part.partName}-${index}`}
            className={'part-item' + (index === beat.partIndex ? ' active' : '')}
          >
            <button type="button" onClick={() => jumpToPart(index)}>
              <span className="part-item-name">{part.partName}</span>
              <span className="part-item-measures">{part.nbMeasure} mes.</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="hint">Cliquer sur une partie permet d'y sauter directement.</p>
    </div>
  );
}
