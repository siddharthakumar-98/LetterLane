import { GameError, type Mark } from './types';

export const MAX_PHRASE_WORDS = 7;
export const MAX_PHRASE_LETTERS = 105;
export const MAX_WORD_LETTERS = 15;

/** Punctuation is presentation; only ASCII letters occupy playable slots. */
export function normalizePhrase(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[‘’]/g, "'")
    .replace(/[‐‑–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}
export function playableLetters(value: string): string {
  return normalizePhrase(value).replace(/[^A-Z]/g, '');
}
export function phraseTemplate(value: string): string {
  return normalizePhrase(value).replace(/[A-Z]/g, '_');
}
export function phraseWords(value: string) {
  let offset = 0;
  return normalizePhrase(value)
    .split(' ')
    .filter(Boolean)
    .map((pattern) => {
      const length = (pattern.match(/[A-Z_]/g) ?? []).length;
      const word = { pattern, offset, length };
      offset += length;
      return word;
    });
}
export function phraseMetadata(value: string) {
  const words = phraseWords(value);
  return {
    wordCount: words.length,
    letterCount: words.reduce((sum, word) => sum + word.length, 0),
  };
}
export function phraseEntry(value: string, collection: string) {
  const text = normalizePhrase(value);
  const words = phraseWords(text);
  const metadata = phraseMetadata(text);
  if (
    !/^[A-Z][A-Z '.,!?-]*[A-Z.!?]$/.test(text) ||
    metadata.wordCount < 2 ||
    metadata.wordCount > MAX_PHRASE_WORDS ||
    metadata.letterCount > MAX_PHRASE_LETTERS ||
    words.some((word) => word.length === 0 || word.length > MAX_WORD_LETTERS)
  )
    return null;
  return {
    id: `${collection}:${playableLetters(text).toLowerCase()}`,
    collection,
    text,
    ...metadata,
  };
}
export function formatPhraseGuess(template: string, letters: string) {
  let index = 0;
  return phraseTemplate(template).replace(/_/g, () => letters[index++] ?? '_');
}
export function samePhrase(answer: string, guess: string) {
  return playableLetters(answer) === playableLetters(guess);
}
export function invalidWordMessage(indices: number[]): string {
  if (!indices.length) return '';
  if (indices.length === 1) return `Word ${indices[0]} is not in word list`;
  const list =
    indices.length === 2
      ? indices.join(' and ')
      : `${indices.slice(0, -1).join(', ')}, and ${indices.at(-1)}`;
  return `Words ${list} are not in word list`;
}
/** Only completed template words are eligible for live dictionary checks. */
export function completedPhraseWords(template: string, letters: string) {
  return phraseWords(template).flatMap((word, index) =>
    word.length > 0 && letters.length >= word.offset + word.length
      ? [
          {
            position: index + 1,
            word: formatPhraseGuess(
              word.pattern,
              letters.slice(word.offset, word.offset + word.length),
            ),
          },
        ]
      : [],
  );
}
/** Independent of any answer. Shared by live checks and final submission. */
export function isAllowedPhraseWord(
  value: string,
  allowed: ReadonlySet<string>,
) {
  const word = normalizePhrase(value).replace(/[.,!?]+$/, '');
  if (!/^[A-Z]+(?:['-][A-Z]+)*$/.test(word)) return false;
  return (
    allowed.has(playableLetters(word)) ||
    (word.includes('-') &&
      word.split('-').every((part) => allowed.has(playableLetters(part))))
  );
}
export function validatePhraseGuess(
  value: string,
  template: string,
  allowed: ReadonlySet<string>,
) {
  const normalized = normalizePhrase(value);
  if (!/^[A-Z '.,!?-]+$/.test(normalized))
    throw new GameError('Enter letters to fill every word.', 422);
  const letters = playableLetters(normalized);
  const { letterCount } = phraseMetadata(template);
  if (letters.length !== letterCount)
    throw new GameError(
      `Fill all ${letterCount} letters before submitting.`,
      422,
    );
  const invalid = completedPhraseWords(template, letters).flatMap(
    ({ word, position }) =>
      isAllowedPhraseWord(word, allowed) ? [] : [position],
  );
  if (invalid.length) throw new GameError(invalidWordMessage(invalid), 422);
  return letters;
}
/** Allocate occurrences once: green everywhere first, then same-word orange,
 * then cross-word blue. Excess duplicates are grey, just as in Words. */
export function scorePhrase(answer: string, guess: string): Mark[] {
  const letters = playableLetters(answer);
  const entered = playableLetters(guess);
  if (letters.length !== entered.length || !letters.length)
    throw new Error('Phrase guesses must fill the template.');
  const words = phraseWords(answer);
  const wordAt = words.flatMap((word, index) =>
    Array<number>(word.length).fill(index),
  );
  const marks: Mark[] = Array<Mark>(letters.length).fill('absent');
  const used = Array<boolean>(letters.length).fill(false);
  for (let i = 0; i < letters.length; i++) {
    if (letters[i] === entered[i]) {
      marks[i] = 'correct';
      used[i] = true;
    }
  }
  for (const sameWord of [true, false]) {
    for (let i = 0; i < entered.length; i++) {
      if (marks[i] !== 'absent') continue;
      const match = [...letters].findIndex(
        (letter, j) =>
          !used[j] &&
          letter === entered[i] &&
          (wordAt[i] === wordAt[j]) === sameWord,
      );
      if (match !== -1) {
        used[match] = true;
        marks[i] = sameWord ? 'present' : 'elsewhere';
      }
    }
  }
  return marks;
}
