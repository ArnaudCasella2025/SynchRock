import { useState } from 'react';
import { useDragReorder } from '../hooks/useDragReorder';
import { isValidSong } from '../types';
import type { Part, Song } from '../types';

interface Props {
  /** The song being edited, or null when creating a brand new one. */
  song: Song | null;
  onSave: (song: Song) => void;
  onCancel: () => void;
}

/** A part's measures as an editable list of segments — one segment per
 * sub-part. A part with no subdivision is just a single segment, so this
 * doubles as the plain "number of measures" field in that common case. */
interface EditablePart {
  _id: string;
  partName: string;
  beatsPerMeasure?: number;
  segments: number[];
}

function toEditableParts(parts: Part[]): EditablePart[] {
  return parts.map((p) => ({
    _id: crypto.randomUUID(),
    partName: p.partName,
    beatsPerMeasure: p.beatsPerMeasure,
    segments: p.subParts ?? [p.nbMeasure],
  }));
}

function toPart(p: EditablePart): Part {
  const part: Part = {
    partName: p.partName,
    nbMeasure: p.segments.reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0),
  };
  if (p.beatsPerMeasure !== undefined) part.beatsPerMeasure = p.beatsPerMeasure;
  if (p.segments.length > 1) part.subParts = p.segments;
  return part;
}

export function SongEditor({ song, onSave, onCancel }: Props) {
  const [titre, setTitre] = useState(song?.titre ?? '');
  const [bpm, setBpm] = useState(song?.bpm ?? 120);
  const [parts, setParts] = useState<EditablePart[]>(() =>
    toEditableParts(song?.parts ?? [{ partName: '', nbMeasure: 4 }])
  );
  const [error, setError] = useState<string | null>(null);

  const { setItemRef, handlePointerDown, draggingItem } = useDragReorder(parts, setParts);

  function updatePartName(id: string, partName: string) {
    setParts((current) => current.map((p) => (p._id === id ? { ...p, partName } : p)));
  }

  function addPart() {
    setParts((current) => [
      ...current,
      { _id: crypto.randomUUID(), partName: '', segments: [4] },
    ]);
  }

  function duplicatePart(id: string) {
    setParts((current) => {
      const index = current.findIndex((p) => p._id === id);
      if (index === -1) return current;
      const copy: EditablePart = {
        ...current[index],
        _id: crypto.randomUUID(),
        segments: [...current[index].segments],
      };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  }

  function removePart(id: string) {
    setParts((current) => current.filter((p) => p._id !== id));
  }

  function updateSegment(partId: string, segIndex: number, value: number) {
    setParts((current) =>
      current.map((p) =>
        p._id === partId
          ? { ...p, segments: p.segments.map((n, i) => (i === segIndex ? value : n)) }
          : p
      )
    );
  }

  function addSegment(partId: string) {
    setParts((current) =>
      current.map((p) => (p._id === partId ? { ...p, segments: [...p.segments, 4] } : p))
    );
  }

  function removeSegment(partId: string, segIndex: number) {
    setParts((current) =>
      current.map((p) =>
        p._id === partId && p.segments.length > 1
          ? { ...p, segments: p.segments.filter((_, i) => i !== segIndex) }
          : p
      )
    );
  }

  function handleSave() {
    const candidate: Song = {
      ...(song ?? {}),
      titre: titre.trim(),
      bpm,
      parts: parts.map(toPart),
    };
    if (!isValidSong(candidate)) {
      setError(
        'Vérifie le titre, le tempo (supérieur à 0) et que chaque partie/sous-partie ait un nombre de mesures valide (supérieur à 0).'
      );
      return;
    }
    setError(null);
    onSave(candidate);
  }

  return (
    <div className="editor">
      <header className="player-header">
        <button type="button" className="back-btn" onClick={onCancel}>
          &larr; Annuler
        </button>
        <div className="player-title">
          <h1>{song ? 'Modifier' : 'Nouvelle chanson'}</h1>
        </div>
      </header>

      <label className="field">
        Titre
        <input
          type="text"
          value={titre}
          onChange={(e) => setTitre(e.target.value)}
          placeholder="Titre de la chanson"
        />
      </label>

      <label className="field">
        Tempo (BPM)
        <input
          type="number"
          min={1}
          value={Number.isNaN(bpm) ? '' : bpm}
          onChange={(e) => setBpm(e.target.valueAsNumber)}
        />
      </label>

      <div className="parts-editor">
        <h2>Parties</h2>
        <ul className="parts-editor-list">
          {parts.map((part, index) => {
            const total = part.segments.reduce((sum, n) => sum + (Number.isFinite(n) ? n : 0), 0);
            return (
              <li
                key={part._id}
                ref={setItemRef(part)}
                className={'part-row' + (draggingItem === part ? ' dragging' : '')}
              >
                <div className="part-row-main">
                  <button
                    type="button"
                    className="drag-handle"
                    aria-label="Réordonner cette partie"
                    onPointerDown={handlePointerDown(part)}
                  >
                    ⠿
                  </button>
                  <input
                    type="text"
                    className="part-row-name"
                    value={part.partName}
                    placeholder={`Partie ${index + 1}`}
                    onChange={(e) => updatePartName(part._id, e.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Dupliquer cette partie"
                    onClick={() => duplicatePart(part._id)}
                  >
                    &#10697;
                  </button>
                  <button
                    type="button"
                    className="icon-btn danger"
                    aria-label="Supprimer cette partie"
                    onClick={() => removePart(part._id)}
                  >
                    &times;
                  </button>
                </div>
                <div className="part-row-segments">
                  {part.segments.map((len, segIndex) => (
                    <div className="segment" key={segIndex}>
                      <input
                        type="number"
                        min={1}
                        className="segment-input"
                        value={Number.isNaN(len) ? '' : len}
                        onChange={(e) => updateSegment(part._id, segIndex, e.target.valueAsNumber)}
                      />
                      <span className="segment-unit">mes.</span>
                      {part.segments.length > 1 && (
                        <button
                          type="button"
                          className="icon-btn small"
                          aria-label="Supprimer cette sous-partie"
                          onClick={() => removeSegment(part._id, segIndex)}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className="icon-btn small"
                    aria-label="Ajouter une sous-partie"
                    onClick={() => addSegment(part._id)}
                  >
                    +
                  </button>
                  {part.segments.length > 1 && (
                    <span className="segments-total">= {total} mesures</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <button type="button" className="secondary" onClick={addPart}>
          + Ajouter une partie
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="transport">
        <button type="button" className="primary big" onClick={handleSave}>
          Sauvegarder
        </button>
      </div>
    </div>
  );
}
