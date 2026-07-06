import { useRef, useState } from 'react';
import { parseSongLibrary } from '../types';
import type { Song } from '../types';

interface Props {
  onImport: (songs: Song[]) => void;
  onClose: () => void;
}

const PLACEHOLDER = `{
  "songs": [
    {
      "titre": "Ma chanson",
      "bpm": 120,
      "parts": [
        { "partName": "intro", "nbMeasure": 4 },
        { "partName": "couplet", "nbMeasure": 8 },
        { "partName": "refrain", "nbMeasure": 8 }
      ]
    }
  ]
}`;

export function SongImport({ onImport, onClose }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleImport() {
    try {
      const songs = parseSongLibrary(text);
      setError(null);
      onImport(songs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleFile(file: File) {
    const content = await file.text();
    setText(content);
    try {
      const songs = parseSongLibrary(content);
      setError(null);
      onImport(songs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Importer des chansons (JSON)</h2>
        <p className="hint">
          Structure attendue : <code>{'{ titre, bpm, parts: [{ partName, nbMeasure }] }'}</code>
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={12}
          spellCheck={false}
        />
        {error && <p className="error">{error}</p>}
        <div className="modal-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Choisir un fichier
          </button>
          <button type="button" onClick={handleImport} disabled={!text.trim()}>
            Importer
          </button>
          <button type="button" className="secondary" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
