import type { BotDifficulty } from './types';

export const BOT_PROFILES = {
  easy: {
    name: 'Pipsqueak',
    label: 'Easy',
    description: 'A gentle pace and simpler guesses.',
    thinkMinMs: 26_000,
    thinkMaxMs: 34_000,
    shortlistSize: Infinity,
  },
  medium: {
    name: 'Pipper',
    label: 'Medium',
    description: 'A steady pace and a little challenge.',
    thinkMinMs: 16_000,
    thinkMaxMs: 22_000,
    shortlistSize: 10,
  },
  hard: {
    name: 'Pip',
    label: 'Hard',
    description: 'Quick thinking and sharp guesses.',
    thinkMinMs: 8_000,
    thinkMaxMs: 12_000,
    shortlistSize: 3,
  },
} as const satisfies Record<
  BotDifficulty,
  {
    name: string;
    label: string;
    description: string;
    thinkMinMs: number;
    thinkMaxMs: number;
    shortlistSize: number;
  }
>;
