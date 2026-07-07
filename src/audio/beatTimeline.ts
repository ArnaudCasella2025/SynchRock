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
   * first beat, layered over a plain click so the tempo pulse doesn't drop
   * out. False when the name was already announced separately beforehand —
   * e.g. jumping to a part speaks its name up front, then plays a plain
   * count-in, so this beat doesn't need to announce anything itself. */
  announceUpcomingPart: boolean;
  /** True for the pre-roll measure played before the song's first real beat. */
  isPreRoll: boolean;
  /** 0-based index of the current sub-part within the part (see `Part.subParts`
   * in types.ts). Always 0 when the part has no subdivision. -1 during the
   * pre-roll count-in. */
  subPartIndex: number;
  /** Number of sub-parts in the current part (1 when it has no subdivision). */
  totalSubParts: number;
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
      subPartIndex: -1,
      totalSubParts: 0,
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
    const subParts = part.subParts ?? [part.nbMeasure];
    const lastMeasureInPart = part.nbMeasure - 1;
    const nextPart = song.parts[partIndex + 1];

    // Map each (0-based) measureInPart to the sub-part it belongs to, so a
    // count-in fires at the end of every sub-part, not just the part's own
    // last measure.
    let measureInPart = 0;
    subParts.forEach((subPartLength, subPartIndex) => {
      const lastMeasureInSubPart = measureInPart + subPartLength - 1;

      for (let i = 0; i < subPartLength; i++, measureInPart++) {
        const isCountInMeasure = measureInPart === lastMeasureInSubPart;
        const isEndOfPart = measureInPart === lastMeasureInPart;

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
            countInNumber: isCountInMeasure ? beatInMeasure + 1 : null,
            // Only the part's very last sub-part announces what comes next;
            // an interior sub-part boundary is just a plain count-in that
            // continues within the same part.
            upcomingPartName: isCountInMeasure && isEndOfPart ? nextPart?.partName || null : null,
            announceUpcomingPart: true,
            isPreRoll: false,
            subPartIndex,
            totalSubParts: subParts.length,
          });
        }
      }
    });
  });

  return beats;
}
