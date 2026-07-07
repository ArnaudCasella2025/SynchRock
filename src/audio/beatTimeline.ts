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
  /** Name of the part about to start, set on every beat of a count-in measure
   * when that upcoming part has a non-empty name (kept for the whole measure,
   * not just its first beat, so the UI can show "next up" throughout the
   * count-in). Null outside a count-in measure, on the last part's own
   * count-in (nothing follows it), and when the upcoming part is named "". */
  upcomingPartName: string | null;
  /** True when `upcomingPartName` (if set) should be spoken on the count-in's
   * first beat instead of playing its "un" sample. False when the name was
   * already announced separately beforehand — e.g. jumping to a part speaks
   * its name up front, then plays a plain count-in, rather than speaking over
   * beat one of the count-in itself. */
  announceUpcomingPart: boolean;
  /** True for the pre-roll measure played before the song's first real beat. */
  isPreRoll: boolean;
}

/** Builds a standalone pre-roll measure (partIndex -1) with "un/deux/trois/
 * quatre"-style count-in clicks — used both for the song's own pre-roll and
 * for manually jumping to a part mid-rehearsal. When `announce` is true
 * (the default), `upcomingPartName`'s first beat is spoken instead of
 * clicked; pass false when the name was already announced separately right
 * before this count-in starts. */
export function buildCountInBeats(
  beatsPerMeasure: number,
  upcomingPartName: string | null,
  announce = true
): TimelineBeat[] {
  const beats: TimelineBeat[] = [];
  for (let beatInMeasure = 0; beatInMeasure < beatsPerMeasure; beatInMeasure++) {
    beats.push({
      globalIndex: -1,
      partIndex: -1,
      partName: '',
      measureInPart: -1,
      totalMeasuresInPart: 0,
      beatInMeasure,
      beatsPerMeasure,
      accent: beatInMeasure === 0,
      countInNumber: beatInMeasure + 1,
      upcomingPartName,
      announceUpcomingPart: announce,
      isPreRoll: true,
    });
  }
  return beats;
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
  buildCountInBeats(preRollBeatsPerMeasure, firstPart.partName || null).forEach((beat) => {
    beats.push({ ...beat, globalIndex: globalIndex++ });
  });

  song.parts.forEach((part, partIndex) => {
    const beatsPerMeasure =
      part.beatsPerMeasure ?? song.beatsPerMeasure ?? DEFAULT_BEATS_PER_MEASURE;
    const lastMeasureInPart = part.nbMeasure - 1;
    const nextPart = song.parts[partIndex + 1];

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
          upcomingPartName: isCountInMeasure ? nextPart?.partName || null : null,
          announceUpcomingPart: true,
          isPreRoll: false,
        });
      }
    }
  });

  return beats;
}
