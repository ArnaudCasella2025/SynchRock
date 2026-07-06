const FILES = ['claire-1.mp3', 'claire-2.mp3', 'claire-3.mp3', 'claire-4.mp3'];

const SILENCE_THRESHOLD_RATIO = 0.15;
const ANALYSIS_WINDOW_MS = 20;
const PRE_ROLL_MS = 30;

/** Trims leading silence off a decoded sample so playback starts right at
 * the word instead of after a long lead-in — the source recordings have a
 * growing silent lead-in (they were extracted from one continuous take of
 * "un... deux... trois... quatre"), so each one is mostly silence before the
 * actual word near the very end. Keeps a small pre-roll before the detected
 * onset for a natural attack. */
function trimLeadingSilence(ctx: BaseAudioContext, buffer: AudioBuffer): AudioBuffer {
  const data = buffer.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const abs = Math.abs(data[i]);
    if (abs > peak) peak = abs;
  }
  if (peak === 0) return buffer;

  const threshold = peak * SILENCE_THRESHOLD_RATIO;
  const windowSize = Math.max(1, Math.floor((buffer.sampleRate * ANALYSIS_WINDOW_MS) / 1000));
  let onsetSample = 0;
  for (let i = 0; i < data.length; i += windowSize) {
    const end = Math.min(i + windowSize, data.length);
    let sum = 0;
    for (let j = i; j < end; j++) sum += data[j] * data[j];
    if (Math.sqrt(sum / (end - i)) > threshold) {
      onsetSample = i;
      break;
    }
  }

  const preRollSamples = Math.floor((buffer.sampleRate * PRE_ROLL_MS) / 1000);
  const trimStart = Math.max(0, onsetSample - preRollSamples);
  if (trimStart === 0) return buffer;

  const trimmed = ctx.createBuffer(buffer.numberOfChannels, buffer.length - trimStart, buffer.sampleRate);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    trimmed.copyToChannel(buffer.getChannelData(ch).subarray(trimStart), ch);
  }
  return trimmed;
}

let cached: Promise<(AudioBuffer | null)[]> | null = null;

/** Fetches and decodes the four spoken count-in samples ("un", "deux",
 * "trois", "quatre") using the same AudioContext that will play them back.
 * Some browsers (notably WebKit/Safari) have been unreliable about playing
 * an AudioBuffer decoded on a different context — silently producing no
 * sound rather than throwing — so a single shared context avoids that
 * entirely. Decoding doesn't need the context to be running, so this can
 * start as soon as the engine exists, well before any user gesture. A failed
 * fetch/decode yields null for that slot so playback can fall back to a
 * plain click instead of throwing. */
export function loadCountSamples(ctx: AudioContext): Promise<(AudioBuffer | null)[]> {
  if (!cached) {
    cached = Promise.all(
      FILES.map((file) =>
        fetch(`${import.meta.env.BASE_URL}audio/${file}`)
          .then((res) => res.arrayBuffer())
          .then((data) => ctx.decodeAudioData(data))
          .then((buffer) => trimLeadingSilence(ctx, buffer))
          .catch((err) => {
            console.warn(`SynchRock: failed to load count-in sample "${file}"`, err);
            return null;
          })
      )
    );
  }
  return cached;
}
