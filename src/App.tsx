import { useEffect, useState } from 'react';
import './App.css';
import { SongList } from './components/SongList';
import { SongImport } from './components/SongImport';
import { Player } from './components/Player';
import { loadSongs, mergeSongs, saveSongs } from './storage';
import { parseSongLibrary } from './types';
import type { Song } from './types';

type View = { name: 'list' } | { name: 'player'; index: number };

function App() {
  const [songs, setSongs] = useState<Song[]>(() => loadSongs());
  const [view, setView] = useState<View>({ name: 'list' });
  const [importOpen, setImportOpen] = useState(false);

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
        // No shared setlist shipped with this deployment; local imports still work.
      });
  }, []);

  function updateSongs(next: Song[]) {
    setSongs(next);
    saveSongs(next);
  }

  function handleImport(imported: Song[]) {
    updateSongs(mergeSongs(songs, imported));
    setImportOpen(false);
  }

  function handleDelete(index: number) {
    updateSongs(songs.filter((_, i) => i !== index));
  }

  return (
    <>
      {view.name === 'list' && (
        <SongList
          songs={songs}
          onSelect={(index) => setView({ name: 'player', index })}
          onDelete={handleDelete}
          onOpenImport={() => setImportOpen(true)}
        />
      )}
      {view.name === 'player' && songs[view.index] && (
        <Player song={songs[view.index]} onBack={() => setView({ name: 'list' })} />
      )}
      {importOpen && <SongImport onImport={handleImport} onClose={() => setImportOpen(false)} />}
    </>
  );
}

export default App;
