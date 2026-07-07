import { useEffect, useState } from 'react';
import './App.css';
import { SongList } from './components/SongList';
import { SongEditor } from './components/SongEditor';
import { Player } from './components/Player';
import { loadSongs, mergeSongs, saveSongs } from './storage';
import { parseSongLibrary } from './types';
import type { Song } from './types';

type View =
  | { name: 'list' }
  | { name: 'player'; index: number }
  | { name: 'edit'; index: number | null };

function App() {
  const [songs, setSongs] = useState<Song[]>(() => loadSongs());
  const [view, setView] = useState<View>({ name: 'list' });

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}songs.json`)
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error('not found'))))
      .then((raw) => {
        const bundled = parseSongLibrary(raw);
        setSongs((current) => {
          const merged = mergeSongs(current, bundled);
          saveSongs(merged);
          return merged;
        });
      })
      .catch(() => {
        // No shared setlist shipped with this deployment; songs created/edited
        // locally still work.
      });
  }, []);

  function updateSongs(next: Song[]) {
    setSongs(next);
    saveSongs(next);
  }

  function handleDelete(index: number) {
    updateSongs(songs.filter((_, i) => i !== index));
  }

  function handleSaveSong(song: Song, index: number | null) {
    updateSongs(index === null ? [...songs, song] : songs.map((s, i) => (i === index ? song : s)));
    setView({ name: 'list' });
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
