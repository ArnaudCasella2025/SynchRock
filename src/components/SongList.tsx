import { useDragReorder } from '../hooks/useDragReorder';
import type { Song } from '../types';

interface Props {
  songs: Song[];
  onSelect: (index: number) => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onCreate: () => void;
  onReorder: (next: Song[]) => void;
}

export function SongList({ songs, onSelect, onEdit, onDelete, onCreate, onReorder }: Props) {
  const { setItemRef, handlePointerDown, draggingItem } = useDragReorder(songs, onReorder);

  function moveSong(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= songs.length) return;
    const next = songs.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onReorder(next);
  }

  return (
    <div className="song-list">
      <header className="app-header">
        <div className="logo">
          <div className="logo-bars" aria-hidden="true">
            <span className="logo-bar" />
            <span className="logo-bar" />
            <span className="logo-bar" />
            <span className="logo-bar" />
            <span className="logo-bar" />
          </div>
          <h1>PULSE</h1>
        </div>
        <p className="subtitle">
          Clic de groupe &amp; annonce des parties &middot; setlist partagé &middot; v
          {__APP_VERSION__}
        </p>
      </header>

      <button type="button" className="primary add-song-btn" onClick={onCreate}>
        + Nouvelle chanson
      </button>

      <ul className="cards">
        {songs.map((song, index) => {
          const totalMeasures = song.parts.reduce((sum, p) => sum + p.nbMeasure, 0);
          return (
            <li
              key={`${song.titre}-${index}`}
              ref={setItemRef(song)}
              className={'card' + (draggingItem === song ? ' dragging' : '')}
            >
              <button
                type="button"
                className="drag-handle"
                aria-label={`Réordonner ${song.titre}`}
                onPointerDown={handlePointerDown(song)}
              >
                ⠿
              </button>
              <div className="card-reorder">
                <button
                  type="button"
                  className="reorder-btn"
                  aria-label={`Monter ${song.titre}`}
                  disabled={index === 0}
                  onClick={() => moveSong(index, -1)}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="reorder-btn"
                  aria-label={`Descendre ${song.titre}`}
                  disabled={index === songs.length - 1}
                  onClick={() => moveSong(index, 1)}
                >
                  ▼
                </button>
              </div>
              <button type="button" className="card-main" onClick={() => onSelect(index)}>
                <span className="card-title">{song.titre}</span>
                <span className="card-meta">
                  {song.bpm} BPM &middot; {song.parts.length} parties &middot; {totalMeasures} mesures
                </span>
              </button>
              <button
                type="button"
                className="card-edit"
                aria-label={`Modifier ${song.titre}`}
                onClick={() => onEdit(index)}
              >
                &#9998;
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

      {songs.length === 0 && <p className="hint">Aucune chanson. Crée-en une pour commencer.</p>}
    </div>
  );
}
