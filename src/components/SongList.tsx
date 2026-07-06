import type { Song } from '../types';

interface Props {
  songs: Song[];
  onSelect: (index: number) => void;
  onDelete: (index: number) => void;
  onOpenImport: () => void;
}

export function SongList({ songs, onSelect, onDelete, onOpenImport }: Props) {
  return (
    <div className="song-list">
      <header className="app-header">
        <h1>SynchRock</h1>
        <p className="subtitle">
          Clic de groupe &amp; annonce des parties &middot; v{__APP_VERSION__}
        </p>
      </header>

      <button type="button" className="primary import-btn" onClick={onOpenImport}>
        + Importer un JSON de chansons
      </button>

      <ul className="cards">
        {songs.map((song, index) => {
          const totalMeasures = song.parts.reduce((sum, p) => sum + p.nbMeasure, 0);
          return (
            <li key={`${song.titre}-${index}`} className="card">
              <button type="button" className="card-main" onClick={() => onSelect(index)}>
                <span className="card-title">{song.titre}</span>
                <span className="card-meta">
                  {song.bpm} BPM &middot; {song.parts.length} parties &middot; {totalMeasures} mesures
                </span>
              </button>
              <button
                type="button"
                className="card-delete"
                aria-label={`Supprimer ${song.titre}`}
                onClick={() => onDelete(index)}
              >
                &times;
              </button>
            </li>
          );
        })}
      </ul>

      {songs.length === 0 && <p className="hint">Aucune chanson. Importez un JSON pour commencer.</p>}
    </div>
  );
}
