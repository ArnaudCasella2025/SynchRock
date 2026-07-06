import { DEFAULT_BEATS_PER_MEASURE, type Song } from '../types';

export interface TimelineBeat {
  globalIndex: number;
  partIndex: number;
  partName: string;
  measureInPart: number;
  totalMeasuresInPart: number;
  beatInMeasure: number;
  beatsPerMeasure: number;
  /** True on the first beat of a measure (the accented click). */
  accent: boolean;
  /** Set when this beat is the start of a part's last measure: name of the part
   * that should be announced as "coming up" (null otherwise). */
  announceNextPart: string | null;
}

/** Flattens a song's parts/measures into a per-beat timeline used for both
 * audio scheduling and UI progress display. */
export function buildTimeline(song: Song): TimelineBeat[] {
  const beats: TimelineBeat[] = [];
  let globalIndex = 0;

  song.parts.forEach((part, partIndex) => {
    const beatsPerMeasure =
      part.beatsPerMeasure ?? song.beatsPerMeasure ?? DEFAULT_BEATS_PER_MEASURE;
    const partStartIdx = globalIndex;

    for (let measureInPart = 0; measureInPart < part.nbMeasure; measureInPart++) {
      for (let beatInMeasure = 0; beatInMeasure < beatsPerMeasure; beatInMeasure++) {
        beats.push({
          globalIndex: globalIndex++,
          partIndex,
          partName: part.partName,
          measureInPart,
          totalMeasuresInPart: part.nbMeasure,
          beatInMeasure,
          beatsPerMeasure,
          accent: beatInMeasure === 0,
          announceNextPart: null,
        });
      }
    }

    const nextPart = song.parts[partIndex + 1];
    if (nextPart) {
      const lastMeasureStartIdx = partStartIdx + (part.nbMeasure - 1) * beatsPerMeasure;
      beats[lastMeasureStartIdx].announceNextPart = nextPart.partName;
    }
  });

  return beats;
}
