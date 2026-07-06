import type { Song } from './types';

const STORAGE_KEY = 'synchrock.songs.v1';

export function loadSongs(): Song[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Song[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSongs(songs: Song[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
}

/** Merges songs into a list, overwriting existing entries that share a title. */
export function mergeSongs(current: Song[], incoming: Song[]): Song[] {
  const merged = [...current];
  for (const song of incoming) {
    const index = merged.findIndex((s) => s.titre === song.titre);
    if (index >= 0) merged[index] = song;
    else merged.push(song);
  }
  return merged;
}
