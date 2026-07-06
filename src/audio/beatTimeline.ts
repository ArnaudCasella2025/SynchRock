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
   * that should be announced as "coming up" (null otherwise, and never set when
   * that part's name is empty — an unnamed part is announced silently). */
  announceNextPart: string | null;
  /** 1-based beat position within a count-in measure (the last measure of every
   * part, plus the very first measure of the song), null on other beats. */
  countInNumber: number | null;
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
    const lastMeasureInPart = part.nbMeasure - 1;

    for (let measureInPart = 0; measureInPart < part.nbMeasure; measureInPart++) {
      for (let beatInMeasure = 0; beatInMeasure < beatsPerMeasure; beatInMeasure++) {
        const isCountInMeasure =
          measureInPart === lastMeasureInPart || (partIndex === 0 && measureInPart === 0);
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
          countInNumber: isCountInMeasure ? beatInMeasure + 1 : null,
        });
      }
    }

    const nextPart = song.parts[partIndex + 1];
    if (nextPart && nextPart.partName !== '') {
      const lastMeasureStartIdx = partStartIdx + lastMeasureInPart * beatsPerMeasure;
      beats[lastMeasureStartIdx].announceNextPart = nextPart.partName;
    }
  });

  return beats;
}
