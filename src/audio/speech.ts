let frenchVoice: SpeechSynthesisVoice | null = null;

function supported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function pickFrenchVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang.toLowerCase().startsWith('fr')) ?? voices[0] ?? null;
}

if (supported()) {
  frenchVoice = pickFrenchVoice();
  window.speechSynthesis.onvoiceschanged = () => {
    frenchVoice = pickFrenchVoice();
  };
}

export function isSpeechSupported(): boolean {
  return supported();
}

export function speak(text: string): void {
  if (!supported()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  if (frenchVoice) utterance.voice = frenchVoice;
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

export function cancelSpeech(): void {
  if (supported()) window.speechSynthesis.cancel();
}

const FRENCH_COUNT_WORDS = [
  'un',
  'deux',
  'trois',
  'quatre',
  'cinq',
  'six',
  'sept',
  'huit',
  'neuf',
  'dix',
  'onze',
  'douze',
];

/** Spoken French word for a 1-based beat count (falls back to the digit past twelve). */
export function countWord(n: number): string {
  return FRENCH_COUNT_WORDS[n - 1] ?? String(n);
}
