import { useEffect, useState } from 'react';
import './App.css';
import { SongList } from './components/SongList';
import { SongEditor } from './components/SongEditor';
import { Player } from './components/Player';
import { loadLegacySongs, subscribeSongs, saveSongs } from './storage';
import type { Song } from './types';

type View =
  | { name: 'list' }
  | { name: 'player'; index: number }
  | { name: 'edit'; index: number | null };

function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>({ name: 'list' });

  useEffect(() => {
    // Live setlist shared by every visitor: fires immediately from the local
    // (offline-capable) cache, then again whenever anyone — this browser or
    // another — writes a change.
    let checkedLegacy = false;
    return subscribeSongs((next) => {
      if (!checkedLegacy) {
        checkedLegacy = true;
        if (next.length === 0) {
          // Nothing in the shared setlist yet — if this browser has songs
          // from before it existed, seed the shared setlist with them
          // instead of silently losing that work.
          const legacy = loadLegacySongs();
          if (legacy.length > 0) {
            setSongs(legacy);
            setLoaded(true);
            void saveSongs(legacy);
            return;
          }
        }
      }
      setSongs(next);
      setLoaded(true);
    });
  }, []);

  function updateSongs(next: Song[]) {
    setSongs(next);
    void saveSongs(next);
  }

  function handleDelete(index: number) {
    updateSongs(songs.filter((_, i) => i !== index));
  }

  function handleSaveSong(song: Song, index: number | null) {
    updateSongs(index === null ? [...songs, song] : songs.map((s, i) => (i === index ? song : s)));
    setView({ name: 'list' });
  }

  if (!loaded) {
    return <p className="hint">Chargement du setlist…</p>;
  }

  return (
    <>
      {view.name === 'list' && (
        <SongList
          songs={songs}
          onSelect={(index) => setView({ name: 'player', index })}
          onEdit={(index) => setView({ name: 'edit', index })}
          onDelete={handleDelete}
          onCreate={() => setView({ name: 'edit', index: null })}
          onReorder={updateSongs}
        />
      )}
      {view.name === 'player' && songs[view.index] && (
        <Player song={songs[view.index]} onBack={() => setView({ name: 'list' })} />
      )}
      {view.name === 'edit' && (
        <SongEditor
          song={view.index !== null ? songs[view.index] : null}
          onSave={(song) => handleSaveSong(song, view.index)}
          onCancel={() => setView({ name: 'list' })}
        />
      )}
    </>
  );
}

export default App;
