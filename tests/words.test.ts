import { expect, it } from 'vitest';
import { ANSWERS, ALLOWED_WORDS, pickAnswer } from '../src/lib/server/words';
it('keeps development answers and allowed vocabulary valid and in sync', () => {
  expect(ANSWERS.length).toBeGreaterThan(500);
  expect(ALLOWED_WORDS.size).toBeGreaterThan(900);
  expect(new Set(ANSWERS).size).toBe(ANSWERS.length);
  for (const answer of ANSWERS) {
    expect(answer).toMatch(/^[A-Z]{5}$/);
    expect(ALLOWED_WORDS.has(answer)).toBe(true);
  }
  for (const word of ALLOWED_WORDS) expect(word).toMatch(/^[A-Z]{5}$/);
});
it('does not reuse the previous answer', () => {
  for (let i = 0; i < 20; i++) expect(pickAnswer('CRANE')).not.toBe('CRANE');
});
