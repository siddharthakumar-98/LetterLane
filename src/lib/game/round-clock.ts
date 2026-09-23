import type { Attempt, GameKind } from './types';

export const INITIAL_TIME_MS = 90_000;
export const TILE_BONUS_MS = 20_000;

/** Phrase rounds allow more reading time; Words retains its original clock. */
export const initialTime = (game: GameKind = 'words') =>
  game === 'phrases' ? 180_000 : INITIAL_TIME_MS;
export function timeBonus(
  marks: Attempt['marks'],
  game: GameKind = 'words',
): number {
  return (
    marks.filter(
      (mark) =>
        mark === 'correct' ||
        mark === 'present' ||
        (game === 'phrases' && mark === 'elsewhere'),
    ).length * (game === 'phrases' ? 5_000 : TILE_BONUS_MS)
  );
}

/** Saved attempts are the ledger: reloading or retrying cannot earn extra time. */
export function roundDeadline(
  startsAt: number | null,
  attempts: Attempt[],
  game: GameKind = 'words',
): number | null {
  if (startsAt === null) return null;
  return (
    startsAt +
    initialTime(game) +
    attempts.reduce(
      (total, attempt) => total + timeBonus(attempt.marks, game),
      0,
    )
  );
}
