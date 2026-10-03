import { expect, it } from 'vitest';
import { reconcileRoom } from '../src/lib/client/room-snapshot';
import { projectRoom } from '../src/lib/game/rules';
import { fixture, p1, p2 } from './fixtures';

it('shares unchanged board histories across polls and presence changes', () => {
  const previous = projectRoom(fixture(), p1, 2000);
  const next = structuredClone(previous);
  next.serverTime += 1000;
  next.revision++;
  next.players[0].lastSeen += 1000;
  const result = reconcileRoom(previous, next);
  expect(result).toEqual(next);
  expect(result.match).toBe(previous.match);
  expect(result.players[0].attempts).toBe(previous.players[0].attempts);
  expect(result.players[1].guessMarks).toBe(previous.players[1].guessMarks);
  expect(result.players[1]).not.toHaveProperty('attempts');
});
it('rejects out-of-order revisions and timestamps without regressing the clock', () => {
  const previous = projectRoom(fixture(), p1, 2000);
  previous.revision = 2;
  expect(
    reconcileRoom(previous, { ...previous, revision: 1, serverTime: 3000 }),
  ).toBe(previous);
  expect(reconcileRoom(previous, { ...previous, serverTime: 1000 })).toBe(
    previous,
  );
});
it('accepts timeout changes at the same revision and reveals history only when provided', () => {
  const previous = projectRoom(fixture(), p1, 2000);
  const next = structuredClone(previous);
  next.serverTime = 100000;
  next.players[0].timedOut = true;
  expect(reconcileRoom(previous, next).players[0].timedOut).toBe(true);
  next.match.phase = 'complete';
  next.match.answer = 'CRANE';
  next.players[1].attempts = [];
  const result = reconcileRoom(previous, next);
  expect(result.match.answer).toBe('CRANE');
  expect(result.players[1].attempts).toEqual([]);
});
it('does not share private data across rooms or identities, and removes revealed history for rematches', () => {
  const room = fixture();
  const previous = projectRoom(room, p1, 2000);
  const otherPlayer = projectRoom(room, p2, 3000);
  expect(reconcileRoom(previous, otherPlayer)).toBe(otherPlayer);
  const otherRoom = projectRoom(fixture(), p1, 3000);
  expect(reconcileRoom(previous, otherRoom)).toBe(otherRoom);
  const next = structuredClone(previous);
  next.match.id = 'next-match';
  previous.players[1].attempts = [];
  expect(reconcileRoom(previous, next).players[1]).not.toHaveProperty(
    'attempts',
  );
});
