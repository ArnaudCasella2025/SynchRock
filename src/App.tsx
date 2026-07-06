import { useState } from 'react';
import './App.css';
import { SongList } from './components/SongList';
import { SongImport } from './components/SongImport';
import { Player } from './components/Player';
import { loadSongs, saveSongs } from './storage';
import type { Song } from './types';

type View = { name: 'list' } | { name: 'player'; index: number };

function App() {
  const [songs, setSongs] = useState<Song[]>(() => loadSongs());
  const [view, setView] = useState<View>({ name: 'list' });
  const [importOpen, setImportOpen] = useState(false);

  function updateSongs(next: Song[]) {
    setSongs(next);
    saveSongs(next);
  }

  function handleImport(imported: Song[]) {
    const merged = [...songs];
    for (const song of imported) {
      const existingIndex = merged.findIndex((s) => s.titre === song.titre);
      if (existingIndex >= 0) merged[existingIndex] = song;
      else merged.push(song);
    }
    updateSongs(merged);
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
