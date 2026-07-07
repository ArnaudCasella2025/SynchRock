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

interface EditablePart extends Part {
  _id: string;
}

function toEditableParts(parts: Part[]): EditablePart[] {
  return parts.map((p) => ({ ...p, _id: crypto.randomUUID() }));
}

export function SongEditor({ song, onSave, onCancel }: Props) {
  const [titre, setTitre] = useState(song?.titre ?? '');
  const [bpm, setBpm] = useState(song?.bpm ?? 120);
  const [parts, setParts] = useState<EditablePart[]>(() =>
    toEditableParts(song?.parts ?? [{ partName: '', nbMeasure: 4 }])
  );
  const [error, setError] = useState<string | null>(null);

  const { setItemRef, handlePointerDown, draggingItem } = useDragReorder(parts, setParts);

  function updatePart(id: string, patch: Partial<Pick<EditablePart, 'partName' | 'nbMeasure'>>) {
    setParts((current) => current.map((p) => (p._id === id ? { ...p, ...patch } : p)));
  }

  function addPart() {
    setParts((current) => [...current, { partName: '', nbMeasure: 4, _id: crypto.randomUUID() }]);
  }

  function duplicatePart(id: string) {
    setParts((current) => {
      const index = current.findIndex((p) => p._id === id);
      if (index === -1) return current;
      const copy: EditablePart = { ...current[index], _id: crypto.randomUUID() };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
  }

  function removePart(id: string) {
    setParts((current) => current.filter((p) => p._id !== id));
  }

  function handleSave() {
    const cleanParts: Part[] = parts.map(({ _id, ...rest }) => rest);
    const candidate: Song = {
      ...(song ?? {}),
      titre: titre.trim(),
      bpm,
      parts: cleanParts,
    };
    if (!isValidSong(candidate)) {
      setError(
        'Vérifie le titre, le tempo (supérieur à 0) et que chaque partie ait un nombre de mesures valide (supérieur à 0).'
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
          {parts.map((part, index) => (
            <li
              key={part._id}
              ref={setItemRef(part)}
              className={'part-row' + (draggingItem === part ? ' dragging' : '')}
            >
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
                onChange={(e) => updatePart(part._id, { partName: e.target.value })}
              />
              <input
                type="number"
                className="part-row-measures"
                min={1}
                value={Number.isNaN(part.nbMeasure) ? '' : part.nbMeasure}
                onChange={(e) => updatePart(part._id, { nbMeasure: e.target.valueAsNumber })}
              />
              <span className="part-row-unit">mes.</span>
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
            </li>
          ))}
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
