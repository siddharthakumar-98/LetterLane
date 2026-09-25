import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createRoom, roomOperation } from '../src/lib/server/rooms';
import { transaction } from '../src/lib/server/db';
import type { RoomView } from '../src/lib/game/types';
import { p1, p2, p3 } from './fixtures';
let folder: string;
beforeAll(async () => {
  folder = await mkdtemp(path.join(os.tmpdir(), 'letterlane-test-'));
  process.env.GAME_BACKEND = 'local';
  process.env.LOCAL_DATA_DIR = folder;
  process.env.E2E_TEST_MODE = '1';
});
afterAll(async () => {
  const runtime = (
    globalThis as typeof globalThis & {
      __letterlaneDB?: { local?: Promise<PGlite> };
    }
  ).__letterlaneDB;
  await (await runtime?.local)?.close();
  await rm(folder, { recursive: true, force: true });
});
it('atomically enforces capacity under racing joins and preserves accepted state', async () => {
  const room = await createRoom(p1, 'Ada', 'duel');
  const joins = await Promise.allSettled([
    roomOperation(room.code, p2, { type: 'join', name: 'Max' }),
    roomOperation(room.code, p3, { type: 'join', name: 'Third' }),
  ]);
  expect(joins.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
  const view = await roomOperation(room.code, p1);
  expect(view.players).toHaveLength(2);
  expect(view.match).not.toHaveProperty('answer');
});
it('serializes duplicate submissions, concurrent guesses, completion and rematch in the database', async () => {
  const room = await createRoom(p1, 'Ada', 'duel');
  await roomOperation(room.code, p2, { type: 'join', name: 'Max' });
  await Promise.all([
    roomOperation(room.code, p1, { type: 'ready' }),
    roomOperation(room.code, p2, { type: 'ready' }),
  ]);
  await transaction(async (db) => {
    await db.query(
      `update private.room_states set state=jsonb_set(jsonb_set(state,'{match,phase}','"active"'),'{match,startsAt}',to_jsonb((extract(epoch from clock_timestamp())*1000-1000)::bigint)) where room_id=$1`,
      [room.id],
    );
  });
  const request = {
    type: 'guess' as const,
    word: 'SLATE',
    requestId: randomUUID(),
    matchId: room.match.id,
  };
  await Promise.all([
    roomOperation(room.code, p1, request),
    roomOperation(room.code, p1, request),
    roomOperation(room.code, p2, {
      ...request,
      word: 'APPLE',
      requestId: randomUUID(),
    }),
  ]);
  const current = await roomOperation(room.code, p1);
  expect(current.players[0].count).toBe(1);
  expect(current.players[1].count).toBe(1);
  expect(current.players[1]).not.toHaveProperty('attempts');
  expect(current.players[0].timerEndsAt! - current.match.startsAt!).toBe(
    130000,
  );
  expect(current.players[1].timerEndsAt! - current.match.startsAt!).toBe(
    130000,
  );
  await expect(
    roomOperation(room.code, p1, {
      ...request,
      word: 'ZZZZZ',
      requestId: randomUUID(),
    }),
  ).rejects.toThrow('dictionary');
  expect((await roomOperation(room.code, p1)).players[0].count).toBe(1);
  await Promise.all([
    roomOperation(room.code, p1, {
      ...request,
      word: 'CRANE',
      requestId: randomUUID(),
    }),
    roomOperation(room.code, p2, {
      ...request,
      word: 'CRANE',
      requestId: randomUUID(),
    }),
  ]);
  const final = await roomOperation(room.code, p2);
  expect(final.match.phase).toBe('complete');
  expect(final.match.answer).toBe('CRANE');
  expect(final.players.every((p) => p.attempts?.length === 2)).toBe(true);
  await Promise.all([
    roomOperation(room.code, p1, { type: 'rematch' }),
    roomOperation(room.code, p2, { type: 'rematch' }),
  ]);
  const next = await roomOperation(room.code, p1);
  expect(next.match.round).toBe(2);
  expect(next.match).not.toHaveProperty('answer');
  expect(next.players.every((p) => p.count === 0)).toBe(true);
  const history = await transaction((db) =>
    db.query('select * from public.guess_attempts where match_id=$1', [
      room.match.id,
    ]),
  );
  expect(history).toHaveLength(4);
});
it('applies Supabase RLS policies and hides private state from authenticated roles', async () => {
  const db = new PGlite();
  await db.waitReady;
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; create schema realtime; create table realtime.messages(id bigint,extension text); create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic',true) $$; create publication supabase_realtime;`,
    );
    await db.exec(
      await readFile('supabase/migrations/202609090001_core.sql', 'utf8'),
    );
    await db.exec(
      await readFile('supabase/migrations/202609090002_security.sql', 'utf8'),
    );
    await db.exec(
      await readFile('supabase/migrations/202609110001_bots.sql', 'utf8'),
    );
    await db.exec(
      await readFile('supabase/migrations/202609220001_phrases.sql', 'utf8'),
    );
    const room = randomUUID(),
      match = randomUUID();
    await db.query(
      "insert into public.players(id,display_name) values($1,'Ada'),($2,'Max'),($3,'Other')",
      [p1, p2, p3],
    );
    await db.query('update public.players set is_bot=true where id=$1', [p2]);
    await db.query(
      "insert into public.rooms(id,code,mode,expires_at) values($1,'ABCDEF','duel',now()+interval '1 day')",
      [room],
    );
    await db.query(
      'insert into public.room_participants values($1,$2,0,true,now()),($1,$3,1,true,now())',
      [room, p1, p2],
    );
    await db.query(
      "insert into public.matches(id,room_id,round,phase) values($1,$2,1,'active')",
      [match, room],
    );
    await db.query(
      'insert into public.guess_attempts values($1,$2,1,\'SLATE\',\'["absent","absent","correct","absent","correct"]\',100,$3)',
      [match, p2, randomUUID()],
    );
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${p1}';`);
    expect((await db.query('select * from public.rooms')).rows).toHaveLength(1);
    expect(
      (await db.query('select * from public.room_participants')).rows,
    ).toHaveLength(2);
    expect(
      (await db.query('select * from public.guess_attempts')).rows,
    ).toHaveLength(0);
    await expect(db.query('select * from private.room_states')).rejects.toThrow(
      'permission denied',
    );
    await expect(
      db.query("update public.matches set phase='complete'"),
    ).rejects.toThrow('permission denied');
    await db.exec(`set request.jwt.claim.sub='${p3}';`);
    expect((await db.query('select * from public.rooms')).rows).toHaveLength(0);
    expect(
      (await db.query('select * from public.room_participants')).rows,
    ).toHaveLength(0);
    await db.exec(`reset role;`);
  } finally {
    await db.close();
  }
});

async function readyForBot(room: RoomView) {
  await roomOperation(room.code, room.selfId, { type: 'ready' });
}
it('a human join prevents bot selection while a concurrent bot request cannot create a third seat', async () => {
  const room = await createRoom(p1, 'Ada', 'duel');
  await readyForBot(room);
  await roomOperation(room.code, p2, { type: 'join', name: 'Max' });
  expect(
    (await roomOperation(room.code, p1)).players.some((p) => p.isBot),
  ).toBe(false);
  await expect(
    roomOperation(room.code, p1, { type: 'play-bot' }),
  ).rejects.toThrow('open seat');
  const racing = await createRoom(p1, 'Ada', 'duel');
  await readyForBot(racing);
  const outcomes = await Promise.allSettled([
    roomOperation(racing.code, p1, { type: 'play-bot' }),
    roomOperation(racing.code, p2, { type: 'join', name: 'Max' }),
  ]);
  expect(
    outcomes.filter((outcome) => outcome.status === 'fulfilled'),
  ).toHaveLength(1);
  const view = await roomOperation(racing.code, p1);
  expect(view.players).toHaveLength(2);
  const rows = await transaction((db) =>
    db.query('select seat from public.room_participants where room_id=$1', [
      racing.id,
    ]),
  );
  expect(rows).toHaveLength(2);
  if (outcomes[1].status === 'fulfilled')
    expect(view.players.some((p) => p.isBot)).toBe(false);
  else expect(view.players.filter((p) => p.isBot)).toHaveLength(1);
});
it('serializes bot assignment and due guesses, masks state, rejects impersonation and supports rematches', async () => {
  const room = await createRoom(p1, 'Ada', 'duel');
  await roomOperation(room.code, p1, { type: 'ready' });
  await readyForBot(room);
  const requests = await Promise.allSettled(
    Array.from({ length: 8 }, () =>
      roomOperation(room.code, p1, { type: 'play-bot' }),
    ),
  );
  expect(
    requests.filter((request) => request.status === 'fulfilled'),
  ).toHaveLength(1);
  const snapshots = await Promise.all(
    Array.from({ length: 8 }, () => roomOperation(room.code, p1)),
  );
  const companion = snapshots[0].players.find((p) => p.isBot)!;
  expect(companion).toMatchObject({ name: 'Pip', ready: true, count: 0 });
  expect(snapshots.every((r) => r.players.length === 2)).toBe(true);
  expect(new Set(snapshots.map((r) => r.revision)).size).toBe(1);
  const [stored] = await transaction((db) =>
    db.query<{ is_bot: boolean }>(
      'select is_bot from public.players where id=$1',
      [companion.id],
    ),
  );
  expect(stored.is_bot).toBe(true);
  await transaction(async (db) => {
    await db.query(
      `update private.room_states set state=jsonb_set(jsonb_set(jsonb_set(state,'{match,phase}','"active"'),'{match,startsAt}',to_jsonb((extract(epoch from clock_timestamp())*1000-20000)::bigint)),'{botNextGuessAt}','0') where room_id=$1`,
      [room.id],
    );
  });
  const moved = await Promise.all(
    Array.from({ length: 8 }, () => roomOperation(room.code, p1)),
  );
  expect(moved.every((r) => r.players.find((p) => p.isBot)?.count === 1)).toBe(
    true,
  );
  expect(moved[0].players.find((p) => p.isBot)).not.toHaveProperty('attempts');
  expect(moved[0]).not.toHaveProperty('botNextGuessAt');
  expect(moved[0].match).not.toHaveProperty('answer');
  const attempts = await transaction((db) =>
    db.query(
      'select * from public.guess_attempts where match_id=$1 and player_id=$2',
      [room.match.id, companion.id],
    ),
  );
  expect(attempts).toHaveLength(1);
  await expect(
    roomOperation(room.code, companion.id, { type: 'heartbeat' }),
  ).rejects.toThrow('Join');
  await roomOperation(room.code, p1, {
    type: 'guess',
    word: 'CRANE',
    requestId: randomUUID(),
    matchId: room.match.id,
  });
  await transaction(async (db) => {
    await db.query(
      "update private.room_states set state=jsonb_set(state,'{match,deadline}','0') where room_id=$1",
      [room.id],
    );
  });
  const completed = await roomOperation(room.code, p1);
  expect(completed.match.phase).toBe('complete');
  expect(completed.players.find((p) => p.isBot)?.rematch).toBe(true);
  expect(completed.players.find((p) => p.isBot)?.attempts).toHaveLength(1);
  const next = await roomOperation(room.code, p1, { type: 'rematch' });
  expect(next.match.round).toBe(2);
  expect(next.match.phase).toBe('countdown');
  expect(next.players.find((p) => p.isBot)?.id).toBe(companion.id);
  expect(next.players.every((p) => p.count === 0)).toBe(true);
});
it('commits a due bot turn even when a human action is rejected', async () => {
  const room = await createRoom(p1, 'Ada', 'duel');
  await roomOperation(room.code, p1, { type: 'ready' });
  await readyForBot(room);
  await roomOperation(room.code, p1, { type: 'play-bot' });
  await transaction(async (db) => {
    await db.query(
      `update private.room_states set state=jsonb_set(jsonb_set(jsonb_set(state,'{match,phase}','"active"'),'{match,startsAt}',to_jsonb((extract(epoch from clock_timestamp())*1000-20000)::bigint)),'{botNextGuessAt}','0') where room_id=$1`,
      [room.id],
    );
  });
  await expect(
    roomOperation(room.code, p1, {
      type: 'guess',
      word: 'ZZZZZ',
      requestId: randomUUID(),
      matchId: room.match.id,
    }),
  ).rejects.toThrow('dictionary');
  const view = await roomOperation(room.code, p1);
  expect(view.players.find((p) => p.isBot)?.count).toBe(1);
  expect(view.players.find((p) => p.id === p1)?.count).toBe(0);
});

it('persists timeout results even when a late guess is rejected', async () => {
  const room = await createRoom(p1, 'Ada', 'duel');
  await roomOperation(room.code, p2, { type: 'join', name: 'Max' });
  await transaction((db) =>
    db.query(
      `update private.room_states set state=jsonb_set(jsonb_set(state,'{match,phase}','"active"'),'{match,startsAt}',to_jsonb((extract(epoch from clock_timestamp())*1000-91000)::bigint)) where room_id=$1`,
      [room.id],
    ),
  );
  await expect(
    roomOperation(room.code, p1, {
      type: 'guess',
      word: 'CRANE',
      requestId: randomUUID(),
      matchId: room.match.id,
    }),
  ).rejects.toThrow('ended');
  const [a, b] = await Promise.all([
    roomOperation(room.code, p1),
    roomOperation(room.code, p2),
  ]);
  expect(a.match.phase).toBe('complete');
  expect(a.match.outcome).toBe('draw');
  expect(a.players.every((p) => p.count === 0 && p.timedOut)).toBe(true);
  expect(b.match).toEqual(a.match);
  await Promise.all([
    roomOperation(room.code, p1, { type: 'rematch' }),
    roomOperation(room.code, p2, { type: 'rematch' }),
  ]);
  const next = await roomOperation(room.code, p1);
  expect(next.players[0].timerEndsAt! - next.match.startsAt!).toBe(90000);
});

it.each([
  ['easy', 'Pipsqueak'],
  ['medium', 'Pipper'],
  ['hard', 'Pip'],
] as const)(
  'stores %s difficulty and assigns the matching companion',
  async (difficulty, name) => {
    const owner = randomUUID();
    const created = await createRoom(owner, 'Solo', 'duel', difficulty);
    expect(created.botDifficulty).toBe(difficulty);
    expect((await roomOperation(created.code, owner)).botDifficulty).toBe(
      difficulty,
    );
    await readyForBot(created);
    const assigned = await roomOperation(created.code, owner, {
      type: 'play-bot',
    });
    expect(assigned.players.find((p) => p.isBot)).toMatchObject({
      name,
      ready: true,
    });
    expect(assigned.botDifficulty).toBe(difficulty);
    expect(
      (await roomOperation(created.code, owner)).players.find((p) => p.isBot)
        ?.name,
    ).toBe(name);
  },
);
