import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  advance,
  applyAction,
  outOfTime,
  projectRoom,
} from '../src/lib/game/rules';
import { roundDeadline, timeBonus } from '../src/lib/game/round-clock';
import { scoreGuess } from '../src/lib/game/scoring';
import { actionSchema } from '../src/lib/game/validation';
import type { Action, Room } from '../src/lib/game/types';
import { allowed, fixture, p1, p2 } from './fixtures';
const act = (room: Room, id: string, action: Action, now: number) =>
  applyAction(room, id, action, now, allowed, () => 'BLOOM', randomUUID);
const guess = (room: Room, word: string): Action => ({
  type: 'guess',
  word,
  requestId: randomUUID(),
  matchId: room.match.id,
});
const deadline = (room: Room, index = 0) =>
  roundDeadline(room.match.startsAt, room.players[index].attempts);

describe('90-second personal clocks with per-tile bonuses', () => {
  it('starts after both ready and the shared countdown, then draws at the exact deadline', () => {
    const room = fixture();
    room.match.phase = 'lobby';
    room.match.startsAt = null;
    expect(deadline(room)).toBeNull();
    act(room, p1, { type: 'ready' }, 1000);
    act(room, p2, { type: 'ready' }, 2000);
    expect(room.match.startsAt).toBe(5000);
    expect(deadline(room)).toBe(95000);
    expect(deadline(room, 1)).toBe(95000);
    advance(room, 94999);
    expect(room.match.phase).toBe('active');
    advance(room, 95000);
    expect(room.match.outcome).toBe('draw');
  });
  it('awards 20 seconds for EACH evaluated tile, consuming duplicate occurrences correctly', () => {
    expect(timeBonus(scoreGuess('APPLE', 'ALLEY'))).toBe(60000); // One green, two yellows; second L is gray.
    expect(timeBonus(scoreGuess('CRANE', 'SLATE'))).toBe(40000);
    expect(timeBonus(scoreGuess('CRANE', 'FOUND'))).toBe(20000); // Yellow only.
    expect(timeBonus(scoreGuess('CRANE', 'BLOOM'))).toBe(0);
    expect(timeBonus(scoreGuess('CRANE', 'CRANE'))).toBe(100000);
  });
  it('keeps clocks independent and awards again for matching tiles in another unique word', () => {
    const room = fixture();
    act(room, p1, guess(room, 'SLATE'), 2000);
    act(room, p1, guess(room, 'SHARK'), 3000);
    act(room, p2, guess(room, 'BLOOM'), 3000);
    expect(deadline(room)).toBe(171000);
    expect(deadline(room, 1)).toBe(91000);
    expect(projectRoom(room, p2, 4000).players[0].timerEndsAt).toBe(171000);
    expect(projectRoom(room, p2, 4000).players[0]).not.toHaveProperty(
      'attempts',
    );
  });
  it('does not reward invalid guesses, duplicate words or retries and survives rejoining', () => {
    const room = fixture();
    const submission = guess(room, 'SLATE');
    act(room, p1, submission, 2000);
    act(room, p1, submission, 3000);
    expect(() => act(room, p1, guess(room, 'SLATE'), 4000)).toThrow(
      'already tried',
    );
    expect(() => act(room, p1, guess(room, 'ZZZZZ'), 4000)).toThrow(
      'dictionary',
    );
    const restored = JSON.parse(JSON.stringify(room)) as Room;
    act(restored, p1, { type: 'join', name: 'Ada' }, 90000);
    expect(deadline(restored)).toBe(131000);
    expect(restored.players[0].attempts).toHaveLength(1);
    act(restored, p1, submission, 150000); // Safe retry after timeout, no new attempt/bonus.
    expect(deadline(restored)).toBe(131000);
  });
  it('accepts before expiry and refuses a solving guess exactly at the other clock’s deadline', () => {
    const room = fixture();
    act(room, p1, guess(room, 'SLATE'), 90999);
    expect(() => act(room, p2, guess(room, 'CRANE'), 91000)).toThrow(
      'time is up',
    );
    expect(room.players[1].attempts).toHaveLength(0);
    expect(room.match.phase).toBe('active');
    act(room, p1, guess(room, 'CRANE'), 100000);
    expect(room.match.winnerId).toBe(p1);
  });
  it('resolves by existing points after both expire, with stable results on later reads', () => {
    const room = fixture();
    act(room, p1, guess(room, 'SLATE'), 2000);
    advance(room, 91000);
    expect(room.match.phase).toBe('active');
    advance(room, 131000);
    expect(room.match.outcome).toBe('points');
    expect(room.match.winnerId).toBe(p1);
    const ended = room.match.endedAt;
    advance(room, 200000);
    expect(room.match.endedAt).toBe(ended);
    expect(projectRoom(room, p1, 200000).players.every((p) => p.timedOut)).toBe(
      true,
    );
  });
  it('settles a player out of guesses against a player out of time', () => {
    const room = fixture();
    for (const word of ['SLATE', 'APPLE', 'BLOOM', 'JELLY', 'MIGHT', 'FOUND'])
      act(room, p1, guess(room, word), 2000);
    advance(room, 91000);
    expect(room.match.phase).toBe('complete');
    expect(outOfTime(room, room.players[0], 200000)).toBe(false);
  });
  it('preserves the simultaneous solve window near expiry', () => {
    const room = fixture();
    act(room, p1, guess(room, 'SLATE'), 2000);
    act(room, p1, guess(room, 'CRANE'), 90500);
    act(room, p2, guess(room, 'CRANE'), 90999);
    expect(room.match.winnerId).toBe(p2); // Fewer guesses within 750ms, before its own deadline.
  });
  it('co-op allows a remaining teammate to win and otherwise loses, then resets bonuses on rematch', () => {
    const room = fixture();
    room.mode = 'coop';
    act(room, p1, guess(room, 'SLATE'), 2000);
    act(room, p1, guess(room, 'CRANE'), 100000);
    expect(room.match.outcome).toBe('team-win');
    act(room, p1, { type: 'rematch' }, 101000);
    act(room, p2, { type: 'rematch' }, 101000);
    expect(deadline(room)).toBe(194000);
    expect(deadline(room, 1)).toBe(194000);
    expect(room.players.every((p) => p.attempts.length === 0)).toBe(true);
    advance(room, 194000);
    expect(room.match.outcome).toBe('team-loss');
  });
  it('does not relabel an early loser as timed out when results are viewed later', () => {
    const room = fixture();
    act(room, p1, guess(room, 'CRANE'), 2000);
    advance(room, 2750);
    expect(projectRoom(room, p1, 200000).players[1].timedOut).toBe(false);
  });
  it('rejects client-supplied clock values and bonuses', () => {
    const action = guess(fixture(), 'SLATE');
    for (const extra of [
      { timerEndsAt: 9999999 },
      { bonusMs: 60000 },
      { now: 1 },
    ])
      expect(actionSchema.safeParse({ ...action, ...extra }).success).toBe(
        false,
      );
  });
});

it('settles a delayed read at the logical finish time without inventing a loser timeout', () => {
  const room = fixture();
  act(room, p1, guess(room, 'CRANE'), 2000);
  advance(room, 200000);
  expect(room.match.endedAt).toBe(2750);
  expect(projectRoom(room, p1, 200000).players[1].timedOut).toBe(false);
  const expired = fixture();
  act(expired, p1, guess(expired, 'SLATE'), 2000);
  advance(expired, 200000);
  expect(expired.match.endedAt).toBe(131000);
});

it('shares both clocks and freezes a finished opponent clock without exposing guesses', () => {
  const room = fixture();
  act(room, p2, guess(room, 'CRANE'), 2000);
  const opponent = projectRoom(room, p1, 2100).players[1];
  expect(opponent.timerEndsAt).toBe(191000);
  expect(opponent.timerStoppedAt).toBe(2000);
  expect(opponent).not.toHaveProperty('attempts');
  expect(projectRoom(room, p1, 2200).players[1].timerStoppedAt).toBe(2000);
  expect(projectRoom(room, p1, 2200).match).not.toHaveProperty('answer');
});
