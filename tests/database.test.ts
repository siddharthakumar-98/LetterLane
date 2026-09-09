import { beforeAll, afterAll, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { createRoom, roomOperation } from '../src/lib/server/rooms';
import { transaction } from '../src/lib/server/db';
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
    const room = randomUUID(),
      match = randomUUID();
    await db.query(
      "insert into public.players(id,display_name) values($1,'Ada'),($2,'Max'),($3,'Other')",
      [p1, p2, p3],
    );
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
