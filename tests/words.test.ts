import { expect, it } from 'vitest';
import { ANSWERS, ALLOWED_WORDS, pickAnswer } from '../src/lib/server/words';
import allowed from '../src/lib/server/dictionary/allowed-guesses.json';
import { validateGuess } from '../src/lib/game/validation';
it('keeps answers and the SCOWL guess vocabulary valid and in sync', () => {
  expect(ANSWERS.length).toBeGreaterThan(500);
  // SCOWL size 70 (see dictionary/SOURCES.md); no extracted NYT entries.
  expect(ALLOWED_WORDS.size).toBe(6829);
  expect(allowed.length).toBe(ALLOWED_WORDS.size);
  expect(allowed).toEqual([...allowed].sort());
  expect(new Set(ANSWERS).size).toBe(ANSWERS.length);
  for (const answer of ANSWERS) {
    expect(answer).toMatch(/^[A-Z]{5}$/);
    expect(ALLOWED_WORDS.has(answer)).toBe(true);
  }
  for (const word of ALLOWED_WORDS) expect(word).toMatch(/^[A-Z]{5}$/);
});
it.each(['irate', 'plows', 'loops'])(
  'accepts and normalizes the previously rejected guess %s',
  (word) => {
    expect(validateGuess(` ${word} `, ALLOWED_WORDS)).toBe(word.toUpperCase());
  },
);
it.each(['ADIEU', 'AUDIO', 'RAISE', 'ARISE', 'CRATE', 'SLANT'])(
  'accepts the common opening guess %s',
  (word) => {
    expect(validateGuess(word, ALLOWED_WORDS)).toBe(word);
  },
);
it.each(['ZZZZZ', 'LOOP', 'LOOPS!', '12345'])(
  'still rejects invalid guesses: %s',
  (word) => {
    expect(() => validateGuess(word, ALLOWED_WORDS)).toThrow();
  },
);
it('does not reuse the previous answer', () => {
  for (let i = 0; i < 20; i++) expect(pickAnswer('CRANE')).not.toBe('CRANE');
});
