import 'server-only';
import type { GameKind } from '../game/types';
import { ALLOWED_WORDS, pickAnswer } from './words';
import { PHRASE_WORDS, pickPhrase } from './phrases';
export const puzzleWords = (game: GameKind = 'words') =>
  game === 'phrases' ? PHRASE_WORDS : ALLOWED_WORDS;
export const pickPuzzle = (game: GameKind = 'words', previous?: string) =>
  game === 'phrases' ? pickPhrase(previous) : pickAnswer(previous);
