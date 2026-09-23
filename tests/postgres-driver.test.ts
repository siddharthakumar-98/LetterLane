import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type postgres from 'postgres';
import { createRoom, roomOperation } from '../src/lib/server/rooms';
import { transaction } from '../src/lib/server/db';
import { p1, p2 } from './fixtures';

// Use the real production driver and DB adapter. Only transport settings differ:
// this isolated Unix socket has no TLS and PGlite has one database connection.
vi.mock('postgres', async (importOriginal) => {
  const actual = await importOriginal<{ default: typeof postgres }>();
  return {
    ...actual,
    default: (url: string, options: Record<string, unknown>) =>
      actual.default(url, {
        ...options,
        ssl: false,
        max: 1,
        path: process.env.TEST_DB_SOCKET,
      }),
  };
});

let db: PGlite;
let server: PGLiteSocketServer;
let folder: string;
beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), 'letterlane-wire-'));
  db = await PGlite.create();
  await db.exec(
    await readFile('supabase/migrations/202609090001_core.sql', 'utf8'),
  );
  await db.exec(
    await readFile('supabase/migrations/202609110001_bots.sql', 'utf8'),
  );
  await db.exec(
    await readFile('supabase/migrations/202609220001_phrases.sql', 'utf8'),
  );
  server = new PGLiteSocketServer({ db, path: join(folder, '.s.PGSQL.5432') });
  await server.start();
  vi.stubEnv('GAME_BACKEND', 'supabase');
  vi.stubEnv(
    'DATABASE_URL',
    'postgresql://postgres:postgres@localhost/postgres',
  );
  vi.stubEnv('TEST_DB_SOCKET', join(folder, '.s.PGSQL.5432'));
});
afterAll(async () => {
  const shared = globalThis as typeof globalThis & {
    __letterlaneDB?: { pool?: ReturnType<typeof postgres> };
  };
  await shared.__letterlaneDB?.pool?.end();
  await server?.stop();
  await db?.close();
  if (folder) await rm(folder, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

it('round-trips room objects and guess arrays through the production Postgres driver', async () => {
  const created = await createRoom(p1, 'Ada', 'duel');
  const [stored] = await transaction((tx) =>
    tx.query<{ kind: string }>(
      'select jsonb_typeof(state) as kind from private.room_states where room_id=$1',
      [created.id],
    ),
  );
  expect(stored.kind).toBe('object');
  expect((await roomOperation(created.code, p1)).id).toBe(created.id);
  await roomOperation(created.code, p2, { type: 'join', name: 'Max' });
  await roomOperation(created.code, p1, { type: 'ready' });
  await roomOperation(created.code, p2, { type: 'ready' });
  await transaction((tx) =>
    tx.query(
      `update private.room_states set state=jsonb_set(jsonb_set(jsonb_set(state,'{match,phase}','"active"'),'{match,answer}','"CRANE"'),'{match,startsAt}',to_jsonb((extract(epoch from clock_timestamp())*1000-1000)::bigint)) where room_id=$1`,
      [created.id],
    ),
  );
  const guess = await roomOperation(created.code, p1, {
    type: 'guess',
    word: 'SLATE',
    matchId: created.match.id,
    requestId: randomUUID(),
  });
  expect(guess.players[0].attempts?.[0].marks).toEqual([
    'absent',
    'absent',
    'correct',
    'absent',
    'correct',
  ]);
  const reloaded = await roomOperation(created.code, p1);
  expect(reloaded.players[0].attempts).toEqual(guess.players[0].attempts);
  expect((await roomOperation(created.code, p2)).players[0]).not.toHaveProperty(
    'attempts',
  );
  await roomOperation(created.code, p2, {
    type: 'guess',
    word: 'CRANE',
    matchId: created.match.id,
    requestId: randomUUID(),
  });
  await transaction((tx) =>
    tx.query(
      `update private.room_states set state=jsonb_set(state,'{match,deadline}',to_jsonb((extract(epoch from clock_timestamp())*1000-1000)::bigint)) where room_id=$1`,
      [created.id],
    ),
  );
  expect((await roomOperation(created.code, p1)).match.phase).toBe('complete');
  await roomOperation(created.code, p1, { type: 'rematch' });
  const rematch = await roomOperation(created.code, p2, { type: 'rematch' });
  expect(rematch.match.round).toBe(2);
  expect((await roomOperation(created.code, p1)).match.id).toBe(
    rematch.match.id,
  );
});

it('recovers existing double-encoded rooms and repairs them on the next action', async () => {
  const created = await createRoom(p1, 'Ada', 'coop');
  await transaction(async (tx) => {
    const [row] = await tx.query<{ state: unknown }>(
      'select state from private.room_states where room_id=$1',
      [created.id],
    );
    // Reproduce the original driver binding, which encodes this string twice.
    await tx.query(
      'update private.room_states set state=$2::jsonb where room_id=$1',
      [created.id, JSON.stringify(row.state)],
    );
    const [stored] = await tx.query<{ kind: string }>(
      'select jsonb_typeof(state) as kind from private.room_states where room_id=$1',
      [created.id],
    );
    expect(stored.kind).toBe('string');
  });
  const restored = await roomOperation(created.code, p1);
  expect(restored.id).toBe(created.id);
  expect(restored.match).not.toHaveProperty('answer');
  await roomOperation(created.code, p1, { type: 'ready' });
  const [repaired] = await transaction((tx) =>
    tx.query<{ kind: string }>(
      'select jsonb_typeof(state) as kind from private.room_states where room_id=$1',
      [created.id],
    ),
  );
  expect(repaired.kind).toBe('object');
  expect((await roomOperation(created.code, p1)).players[0].ready).toBe(true);
});

it('persists bot joins, guesses, reconnection and rematches through Postgres.js', async () => {
  const created = await createRoom(p1, 'Ada', 'coop');
  await transaction((tx) =>
    tx.query(
      `update private.room_states set state=jsonb_set(state,'{createdAt}',to_jsonb((extract(epoch from clock_timestamp())*1000-46000)::bigint)) where room_id=$1`,
      [created.id],
    ),
  );
  const ready = await roomOperation(created.code, p1, { type: 'ready' });
  const bot = ready.players.find((player) => player.isBot)!;
  expect(bot.ready).toBe(true);
  expect(ready.match.phase).toBe('countdown');
  await transaction((tx) =>
    tx.query(
      `update private.room_states set state=jsonb_set(jsonb_set(jsonb_set(state,'{match,answer}','"CRANE"'),'{match,startsAt}',to_jsonb((extract(epoch from clock_timestamp())*1000-1000)::bigint)),'{botNextGuessAt}',to_jsonb((extract(epoch from clock_timestamp())*1000-1000)::bigint)) where room_id=$1`,
      [created.id],
    ),
  );
  const played = await roomOperation(created.code, p1);
  expect(played.players.find((player) => player.id === bot.id)?.count).toBe(1);
  expect(played).not.toHaveProperty('botNextGuessAt');
  if (played.match.phase !== 'complete') {
    expect(
      played.players.find((player) => player.id === bot.id),
    ).not.toHaveProperty('attempts');
    expect(played.match).not.toHaveProperty('answer');
  }
  const [stored] = await transaction((tx) =>
    tx.query<{ kind: string; marks_kind: string; is_bot: boolean }>(
      `select jsonb_typeof(s.state) as kind,jsonb_typeof(g.marks) as marks_kind,p.is_bot
     from private.room_states s join public.guess_attempts g on g.match_id=$2
     join public.players p on p.id=g.player_id where s.room_id=$1 and p.id=$3`,
      [created.id, created.match.id, bot.id],
    ),
  );
  expect(stored).toEqual({ kind: 'object', marks_kind: 'array', is_bot: true });
  const reconnected = await roomOperation(created.code, p1);
  expect(
    reconnected.players.find((player) => player.id === bot.id)?.count,
  ).toBe(1);
  if (reconnected.match.phase !== 'complete') {
    await roomOperation(created.code, p1, {
      type: 'guess',
      word: 'CRANE',
      matchId: created.match.id,
      requestId: randomUUID(),
    });
  }
  const complete = await roomOperation(created.code, p1);
  expect(complete.match.phase).toBe('complete');
  expect(complete.players.find((player) => player.id === bot.id)?.rematch).toBe(
    true,
  );
  const rematch = await roomOperation(created.code, p1, { type: 'rematch' });
  expect(rematch.match.round).toBe(2);
  expect(rematch.players.find((player) => player.id === bot.id)?.count).toBe(0);
  expect((await roomOperation(created.code, p1)).match.id).toBe(
    rematch.match.id,
  );
});

it('stores phrase guesses and blue marks through the production Postgres driver', async () => {
  const room = await createRoom(
    randomUUID(),
    'Phrase player',
    'coop',
    'medium',
    'phrases',
  );
  const owner = room.selfId;
  const friend = randomUUID();
  await roomOperation(room.code, friend, { type: 'join', name: 'Friend' });
  await roomOperation(room.code, owner, { type: 'ready' });
  await roomOperation(room.code, friend, { type: 'ready' });
  await transaction((tx) =>
    tx.query(
      `update private.room_states set state=jsonb_set(jsonb_set(jsonb_set(state,'{match,phase}','"active"'),'{match,answer}','"CAT BAG TIME"'),'{match,startsAt}',to_jsonb((extract(epoch from clock_timestamp())*1000-1000)::bigint)) where room_id=$1`,
      [room.id],
    ),
  );
  const result = await roomOperation(room.code, owner, {
    type: 'guess',
    word: 'TAR CAB TIME',
    matchId: room.match.id,
    requestId: randomUUID(),
  });
  expect(result.players[0].attempts?.[0].marks).toContain('elsewhere');
  expect((await roomOperation(room.code, owner)).players[0].attempts).toEqual(
    result.players[0].attempts,
  );
  expect(
    (await roomOperation(room.code, friend)).players[0],
  ).not.toHaveProperty('attempts');
});
