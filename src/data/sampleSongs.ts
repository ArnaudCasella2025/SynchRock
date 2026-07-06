import type { Song } from '../types';

export const sampleSongs: Song[] = [
  {
    titre: 'Exemple - Rock Anthem',
    bpm: 128,
    beatsPerMeasure: 4,
    parts: [
      { partName: 'intro', nbMeasure: 4 },
      { partName: 'couplet', nbMeasure: 8 },
      { partName: 'pre refrain', nbMeasure: 4 },
      { partName: 'refrain', nbMeasure: 8 },
      { partName: 'couplet', nbMeasure: 8 },
      { partName: 'pre refrain', nbMeasure: 4 },
      { partName: 'refrain', nbMeasure: 8 },
      { partName: 'break 1', nbMeasure: 2 },
      { partName: 'solo', nbMeasure: 8 },
      { partName: 'refrain final', nbMeasure: 8 },
      { partName: 'outro', nbMeasure: 4 },
    ],
  },
];
