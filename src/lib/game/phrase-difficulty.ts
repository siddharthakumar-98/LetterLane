import { MAX_PHRASE_WORDS } from './phrases';
import type { PhraseDifficulty } from './types';

export const PHRASE_DIFFICULTIES = ['easy', 'normal'] as const;
export const PHRASE_LEVELS: Record<
  PhraseDifficulty,
  { label: string; maxWords: number }
> = {
  easy: { label: 'Easy', maxWords: 5 },
  normal: { label: 'Normal', maxWords: MAX_PHRASE_WORDS },
};
