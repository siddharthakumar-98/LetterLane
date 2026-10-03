import 'server-only';
import type { GameKind, WordLength, PhraseDifficulty } from '../game/types';
import { wordsForLength, pickAnswer } from './words';
import { PHRASE_WORDS, pickPhrase } from './phrases';
export const puzzleWords = (
  game: GameKind = 'words',
  length: WordLength = 5,
) => (game === 'phrases' ? PHRASE_WORDS : wordsForLength(length));
export const pickPuzzle = (
  game: GameKind = 'words',
  previous?: string,
  length: WordLength = 5,
  phraseDifficulty: PhraseDifficulty = 'normal',
) =>
  game === 'phrases'
    ? pickPhrase(previous, phraseDifficulty)
    : pickAnswer(previous, length);
