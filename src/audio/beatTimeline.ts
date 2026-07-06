import { DEFAULT_BEATS_PER_MEASURE, type Song } from '../types';

export interface TimelineBeat {
  globalIndex: number;
  /** -1 during the song's pre-roll count-in, before any real part has started. */
  partIndex: number;
  partName: string;
  /** -1 during the pre-roll count-in. */
  measureInPart: number;
  totalMeasuresInPart: number;
  beatInMeasure: number;
  beatsPerMeasure: number;
  /** True on the first beat of a measure (the accented click). */
  accent: boolean;
  /** 1-based beat position within a count-in measure (the pre-roll, or the last
   * measure of a part), null on other beats — used to give those beats a
   * distinct (lower-pitched) click. */
  countInNumber: number | null;
  /** True for the pre-roll measure played before the song's first real beat. */
  isPreRoll: boolean;
}

/** Flattens a song's parts/measures into a per-beat timeline used for both audio
 * scheduling and UI progress display. Starts with a pre-roll measure (matching
 * the first part's beats-per-measure) so the count-in fully precedes the first
 * real beat instead of overlapping the first part's own first measure. */
export function buildTimeline(song: Song): TimelineBeat[] {
  const beats: TimelineBeat[] = [];
  let globalIndex = 0;

  const firstPart = song.parts[0];
  const preRollBeatsPerMeasure =
    firstPart.beatsPerMeasure ?? song.beatsPerMeasure ?? DEFAULT_BEATS_PER_MEASURE;
  for (let beatInMeasure = 0; beatInMeasure < preRollBeatsPerMeasure; beatInMeasure++) {
    beats.push({
      globalIndex: globalIndex++,
      partIndex: -1,
      partName: '',
      measureInPart: -1,
      totalMeasuresInPart: 0,
      beatInMeasure,
      beatsPerMeasure: preRollBeatsPerMeasure,
      accent: beatInMeasure === 0,
      countInNumber: beatInMeasure + 1,
      isPreRoll: true,
    });
  }

  song.parts.forEach((part, partIndex) => {
    const beatsPerMeasure =
      part.beatsPerMeasure ?? song.beatsPerMeasure ?? DEFAULT_BEATS_PER_MEASURE;
    const lastMeasureInPart = part.nbMeasure - 1;

    for (let measureInPart = 0; measureInPart < part.nbMeasure; measureInPart++) {
      for (let beatInMeasure = 0; beatInMeasure < beatsPerMeasure; beatInMeasure++) {
        const isCountInMeasure = measureInPart === lastMeasureInPart;
        beats.push({
          globalIndex: globalIndex++,
          partIndex,
          partName: part.partName,
          measureInPart,
          totalMeasuresInPart: part.nbMeasure,
          beatInMeasure,
          beatsPerMeasure,
          accent: beatInMeasure === 0,
          countInNumber: isCountInMeasure ? beatInMeasure + 1 : null,
          isPreRoll: false,
        });
      }
    }
  });

  return beats;
}
