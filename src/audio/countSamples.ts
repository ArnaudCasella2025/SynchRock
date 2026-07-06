const FILES = ['claire-1.mp3', 'claire-2.mp3', 'claire-3.mp3', 'claire-4.mp3'];

let cached: Promise<(AudioBuffer | null)[]> | null = null;

/** Fetches and decodes the four spoken count-in samples ("un", "deux",
 * "trois", "quatre"). Decoding needs an AudioContext but not a running one, so
 * this can start as soon as the module loads, well before any user gesture —
 * by the time playback actually starts, the buffers are ready to schedule
 * sample-accurately, same as the click, with none of speechSynthesis's
 * queuing/latency issues. A failed fetch/decode yields null for that slot so
 * playback can fall back to a plain click instead of throwing. */
export function loadCountSamples(): Promise<(AudioBuffer | null)[]> {
  if (!cached) {
    const decodeCtx = new AudioContext();
    cached = Promise.all(
      FILES.map((file) =>
        fetch(`${import.meta.env.BASE_URL}audio/${file}`)
          .then((res) => res.arrayBuffer())
          .then((data) => decodeCtx.decodeAudioData(data))
          .catch(() => null)
      )
    ).finally(() => {
      void decodeCtx.close();
    });
  }
  return cached;
}
