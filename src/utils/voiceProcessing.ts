/**
 * Shared voice recognition post-processing for consistent transcription across the app.
 * Used by ProjectDetails, surveys, and other components with voice input.
 */

/** Word-to-digit map for spoken numbers 0–10 (including common mishearings so 1–9 are reliably recognized). */
export const WORD_TO_NUM: Record<string, string> = {
  zero: '0', oh: '0',
  one: '1', won: '1', wan: '1', wun: '1',
  two: '2', to: '2', too: '2', tu: '2',
  three: '3', tree: '3', thre: '3', free: '3', threes: '3',
  four: '4', for: '4', fore: '4',
  five: '5', fife: '5', fives: '5',
  six: '6', sicks: '6', sics: '6',
  seven: '7', seben: '7', sebem: '7', sevan: '7',
  eight: '8', ate: '8', ait: '8', aight: '8',
  nine: '9', nin: '9', nines: '9', niner: '9',
  ten: '10',
};

/** Fullwidth digit ０-９ to ASCII 0-9 (some engines return these). */
const FULLWIDTH_DIGITS = /[\uFF10-\uFF19]/g;
function normalizeDigits(s: string): string {
  return s.replace(FULLWIDTH_DIGITS, (ch) => String(ch.charCodeAt(0) - 0xFF10));
}

/** Strip zero-width and other invisible characters that can break parsing. */
const INVISIBLE = /[\u200B-\u200D\uFEFF\u00AD]/g;
function stripInvisible(s: string): string {
  return s.replace(INVISIBLE, '');
}

/**
 * Process transcript for numeric input: word-to-digit, "point"/"dot" for decimals.
 * Handles single-digit 1–9 (spoken or digit), fullwidth digits, and extra text.
 * Returns the parsed number or null if invalid.
 */
export function processNumeric(transcript: string): number | null {
  if (typeof transcript !== 'string') return null;
  let t = stripInvisible(transcript.trim());
  if (!t) return null;
  t = normalizeDigits(t);
  const tLower = t.toLowerCase();
  // Single-token fallback: if user said only "one", "five", etc., match without relying on word boundaries
  const singleWord = tLower.replace(/[^\w]/g, '');
  if (singleWord && WORD_TO_NUM[singleWord] !== undefined) {
    const digit = WORD_TO_NUM[singleWord];
    const num = digit.length > 1 ? parseFloat(digit) : parseInt(digit, 10);
    if (!isNaN(num) && num >= 0) return num;
  }
  let processed = tLower;
  Object.entries(WORD_TO_NUM).forEach(([word, digit]) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    processed = processed.replace(regex, digit);
  });
  const withDots = processed.replace(/\bpoint\b|\bdot\b/gi, '.');
  const digitsOnly = withDots.replace(/[^\d.]/g, '').trim();
  if (digitsOnly === '') return null;
  const num = parseFloat(digitsOnly);
  return !isNaN(num) ? Math.max(0, num) : null;
}

/**
 * Process transcript for phone/digit-only input (e.g. 11-digit contact).
 * Returns string of digits only.
 */
export function processDigitsOnly(transcript: string, maxLength: number): string {
  const t = transcript.toLowerCase();
  let processed = t;
  Object.entries(WORD_TO_NUM).forEach(([word, digit]) => {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    processed = processed.replace(regex, digit);
  });
  return processed.replace(/\D/g, '').slice(0, maxLength);
}

/**
 * Process transcript for email: " at " -> "@", " dot " -> ".", remove spaces.
 */
export function processEmail(transcript: string): string {
  return transcript
    .replace(/\s+at\s+/gi, '@')
    .replace(/\s+dot\s+/gi, '.')
    .replace(/\s+/g, '');
}

/**
 * Process transcript for person names: middle initial " de "/" d " -> " D. ",
 * common name corrections, capitalize first/last word, single-letter words -> "X."
 */
export function processPersonName(rawTranscript: string): string {
  let name = rawTranscript
    .replace(/\s+de\s+/gi, ' D. ')
    .replace(/\s+d\s+/gi, ' D. ');
  name = name.replace(/\byasmine\b/gi, 'Yasmin').replace(/\bmaniago\b/gi, 'Mañago');
  const words = name.trim().split(/\s+/);
  const cap = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
  for (let i = 0; i < words.length; i++) {
    if (words[i].length === 1) words[i] = words[i].toUpperCase() + '.';
    else if (i === 0 || i === words.length - 1) words[i] = cap(words[i]);
  }
  return words.join(' ');
}

/**
 * Capitalize first letter of each word (title case) for generic text fields.
 */
export function processTitleCase(transcript: string): string {
  return transcript
    .trim()
    .split(/\s+/)
    .map((word) => word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word)
    .join(' ');
}
