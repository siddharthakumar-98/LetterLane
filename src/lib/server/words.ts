import 'server-only';
import { randomInt } from 'node:crypto';
import answers from './dictionary/answers.json';
import allowed from './dictionary/allowed-guesses.json';
import longAnswers from './dictionary/long-answers.json';
import ordinaryWords from './phrases/allowed-words.json';
import type { WordLength } from '../game/types';
export const ANSWERS: readonly string[] = answers;
export const ALLOWED_WORDS: ReadonlySet<string> = new Set(allowed);
const vocabularies: Record<WordLength, ReadonlySet<string>> = {
  5: ALLOWED_WORDS,
  6: new Set(ordinaryWords.filter((word) => /^[A-Z]{6}$/.test(word))),
  7: new Set(ordinaryWords.filter((word) => /^[A-Z]{7}$/.test(word))),
};
export const answersForLength = (length: WordLength = 5): readonly string[] =>
  length === 5 ? ANSWERS : longAnswers[length];
export const wordsForLength = (length: WordLength = 5) => vocabularies[length];
export function pickAnswer(previous?: string, length: WordLength = 5) {
  const options = answersForLength(length).filter((w) => w !== previous);
  if (
    process.env.E2E_TEST_MODE === '1' &&
    process.env.GAME_BACKEND === 'local' &&
    !process.env.VERCEL
  ) {
    const [first, second] = {
      5: ['CRANE', 'BLOOM'],
      6: ['GARDEN', 'BRIDGE'],
      7: ['JOURNEY', 'PICTURE'],
    }[length];
    return previous === first ? second : first;
  }
  return options[randomInt(options.length)];
}
