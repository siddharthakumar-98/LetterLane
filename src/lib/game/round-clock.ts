import type { Attempt } from './types';

export const INITIAL_TIME_MS = 90_000;
export const TILE_BONUS_MS = 20_000;

/** Only server-evaluated green/yellow occurrences earn time, including duplicates. */
export function timeBonus(marks: Attempt['marks']): number {
  return (
    marks.filter((mark) => mark === 'correct' || mark === 'present').length *
    TILE_BONUS_MS
  );
}

/** Saved attempts are the ledger: reloading or retrying cannot earn extra time. */
export function roundDeadline(
  startsAt: number | null,
  attempts: Attempt[],
): number | null {
  if (startsAt === null) return null;
  return (
    startsAt +
    INITIAL_TIME_MS +
    attempts.reduce((total, attempt) => total + timeBonus(attempt.marks), 0)
  );
}
