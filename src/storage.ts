import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Song } from './types';

// A single shared document for the whole setlist — every visitor reads and
// writes the same one, no auth/partitioning yet (see README for the planned
// per-user sharing model).
const setlistRef = doc(db, 'setlists', 'shared');

const LEGACY_STORAGE_KEY = 'synchrock.songs.v1';

/** Songs saved locally before the shared Firestore setlist existed — read
 * once to seed the shared setlist so nobody's local work gets silently
 * dropped by the switch. */
export function loadLegacySongs(): Song[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Song[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Subscribes to the shared setlist, invoking `onChange` immediately with the
 * current (possibly cached) value and again on every remote update — from
 * this browser or any other. Returns an unsubscribe function. */
export function subscribeSongs(onChange: (songs: Song[]) => void): () => void {
  return onSnapshot(setlistRef, (snap) => {
    const data = snap.data();
    const songs = data?.songs;
    onChange(Array.isArray(songs) ? songs : []);
  });
}

export function saveSongs(songs: Song[]): Promise<void> {
  return setDoc(setlistRef, { songs });
}
