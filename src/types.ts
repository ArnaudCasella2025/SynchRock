export interface Part {
  partName: string;
  nbMeasure: number;
  /** Overrides the song's default beats-per-measure for this part only. */
  beatsPerMeasure?: number;
  /** Splits this part into consecutive sub-sections, each measured in bars,
   * that must sum to `nbMeasure`. The last measure of every sub-part plays a
   * plain "un, deux, trois, quatre" count-in before continuing within the
   * same part; only the very last sub-part's count-in also announces the
   * next part, exactly as when a part has no subdivision at all. Omit for a
   * part with no internal count-in checkpoints (equivalent to `[nbMeasure]`). */
  subParts?: number[];
}

export interface Song {
  titre: string;
  bpm: number;
  /** Number of clicks per measure (accent falls on the first). Defaults to 4. */
  beatsPerMeasure?: number;
  parts: Part[];
}

export interface SongLibraryFile {
  songs: Song[];
}

export const DEFAULT_BEATS_PER_MEASURE = 4;

export function isValidPart(value: unknown): value is Part {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  if (
    typeof p.partName !== 'string' ||
    typeof p.nbMeasure !== 'number' ||
    !Number.isFinite(p.nbMeasure) ||
    p.nbMeasure <= 0 ||
    (p.beatsPerMeasure !== undefined &&
      !(typeof p.beatsPerMeasure === 'number' && p.beatsPerMeasure > 0))
  ) {
    return false;
  }
  if (p.subParts !== undefined) {
    if (!Array.isArray(p.subParts) || p.subParts.length === 0) return false;
    let sum = 0;
    for (const n of p.subParts) {
      if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return false;
      sum += n;
    }
    if (sum !== p.nbMeasure) return false;
  }
  return true;
}

export function isValidSong(value: unknown): value is Song {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.titre === 'string' &&
    s.titre.trim().length > 0 &&
    typeof s.bpm === 'number' &&
    Number.isFinite(s.bpm) &&
    s.bpm > 0 &&
    (s.beatsPerMeasure === undefined ||
      (typeof s.beatsPerMeasure === 'number' && s.beatsPerMeasure > 0)) &&
    Array.isArray(s.parts) &&
    s.parts.length > 0 &&
    s.parts.every(isValidPart)
  );
}

/** Parses and validates a raw JSON string into a list of songs. Accepts either
 * `{ songs: [...] }` or a bare `[...]` / single song object. */
export function parseSongLibrary(raw: string): Song[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('JSON invalide : impossible de parser le fichier.');
  }

  let candidates: unknown[];
  if (Array.isArray(data)) {
    candidates = data;
  } else if (
    typeof data === 'object' &&
    data !== null &&
    Array.isArray((data as Record<string, unknown>).songs)
  ) {
    candidates = (data as SongLibraryFile).songs;
  } else if (typeof data === 'object' && data !== null && 'titre' in data) {
    candidates = [data];
  } else {
    throw new Error(
      'Structure JSON inattendue : attendu { "songs": [...] } ou une liste de chansons.'
    );
  }

  const songs: Song[] = [];
  candidates.forEach((c, i) => {
    if (!isValidSong(c)) {
      throw new Error(
        `Chanson invalide à l'index ${i} : champs requis "titre" (string), "bpm" (number), "parts" (liste de { partName, nbMeasure }).`
      );
    }
    songs.push(c);
  });
  return songs;
}
