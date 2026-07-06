import { sampleSongs } from './data/sampleSongs';
import type { Song } from './types';

const STORAGE_KEY = 'synchrock.songs.v1';

export function loadSongs(): Song[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return sampleSongs;
    const parsed = JSON.parse(raw) as Song[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : sampleSongs;
  } catch {
    return sampleSongs;
  }
}

export function saveSongs(songs: Song[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(songs));
}
