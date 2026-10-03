import { expect, it, vi } from 'vitest';
import { persistRoom } from '../src/lib/server/room-persistence';
import { fixture } from './fixtures';
import { applyAction } from '../src/lib/game/rules';
import { allowed, p1 } from './fixtures';
import type { DB } from '../src/lib/server/db';

function recordingDB() {
  const query = vi
    .fn<(...args: Parameters<DB['query']>) => Promise<never[]>>()
    .mockResolvedValue([]);
  return { query };
}
it('writes only presence, state and revision on a heartbeat, regardless of guess history', async () => {
  const previous = fixture();
  applyAction(
    previous,
    p1,
    {
      type: 'guess',
      word: 'SLATE',
      requestId: 'request',
      matchId: previous.match.id,
    },
    2000,
    allowed,
    () => 'BLOOM',
    () => 'next',
  );
  const room = structuredClone(previous);
  room.players[0].lastSeen = 5000;
  const db = recordingDB();
  await persistRoom(db, room, previous);
  expect(
    db.query.mock.calls.map(
      ([sql]) => sql.match(/(?:into|update) ([\w.]+)/)?.[1],
    ),
  ).toEqual([
    'public.room_participants',
    'private.room_states',
    'public.room_events',
  ]);
  expect(JSON.parse(db.query.mock.calls[1][1]![1] as string)).toEqual(room);
  expect(room.revision).toBe(previous.revision + 1);
});
it('appends only new attempts while preserving one-based numbering and JSON bindings', async () => {
  const previous = fixture();
  const guess = (word: string, requestId: string) => ({
    type: 'guess' as const,
    word,
    requestId,
    matchId: previous.match.id,
  });
  applyAction(
    previous,
    p1,
    guess('SLATE', 'first'),
    2000,
    allowed,
    () => '',
    () => '',
  );
  const room = structuredClone(previous);
  applyAction(
    room,
    p1,
    guess('APPLE', 'second'),
    3000,
    allowed,
    () => '',
    () => '',
  );
  const db = recordingDB();
  await persistRoom(db, room, previous);
  const inserts = db.query.mock.calls.filter(([sql]) =>
    sql.includes('public.guess_attempts'),
  );
  expect(inserts).toHaveLength(1);
  expect(inserts[0][1]).toEqual([
    room.match.id,
    p1,
    2,
    'APPLE',
    JSON.stringify(room.players[0].attempts[1].marks),
    2000,
    'second',
    'words',
  ]);
});
it('initializes new match projections and expiry on rematch without rewriting player identities', async () => {
  const previous = fixture();
  const room = structuredClone(previous);
  room.match.id = 'next-match';
  room.match.round++;
  room.match.phase = 'countdown';
  room.expiresAt++;
  const db = recordingDB();
  await persistRoom(db, room, previous);
  const statements = db.query.mock.calls.map(([sql]) => sql);
  expect(
    statements.filter((sql) => sql.includes('public.matches')),
  ).toHaveLength(1);
  expect(
    statements.filter((sql) => sql.includes('public.rematch_readiness')),
  ).toHaveLength(2);
  expect(
    statements.filter((sql) => sql.includes('update public.rooms')),
  ).toHaveLength(1);
  expect(
    statements.filter((sql) => sql.includes('public.players')),
  ).toHaveLength(0);
});
it('writes every projection for creation and legacy repair, publishing the revision last', async () => {
  const room = fixture();
  const db = recordingDB();
  await persistRoom(db, room);
  expect(db.query).toHaveBeenCalledTimes(10);
  expect(db.query.mock.calls.at(-1)![0]).toContain('public.room_events');
});
