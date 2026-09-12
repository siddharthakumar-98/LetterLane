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
