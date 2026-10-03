import type { WordLength } from './types';

export const WORD_LENGTHS = [5, 6, 7] as const;
export const WORD_LEVELS: Record<WordLength, { label: string; name: string }> =
  {
    5: { label: 'Easy', name: 'five' },
    6: { label: 'Medium', name: 'six' },
    7: { label: 'Hard', name: 'seven' },
  };
export const wordLengthMessage = (length: WordLength) =>
  `Your guess needs exactly ${WORD_LEVELS[length].name} letters.`;
