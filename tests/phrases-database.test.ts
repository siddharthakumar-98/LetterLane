import { beforeAll, afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createRoom, roomOperation } from '../src/lib/server/rooms';
import { transaction } from '../src/lib/server/db';
import { p1, p2 } from './fixtures';
let folder: string;
beforeAll(async () => {
  folder = await mkdtemp(path.join(tmpdir(), 'letterlane-phrases-'));
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
it('isolates word and phrase progress, rejects whole invalid guesses, persists and rematches phrases', async () => {
  const words = await createRoom(p1, 'Ada', 'duel');
  const phrase = await createRoom(p1, 'Ada', 'coop', 'medium', 'phrases');
  expect(words.game).toBe('words');
  expect(words.match).not.toHaveProperty('phraseTemplate');
  expect(phrase.match.phraseTemplate).toBe('_______ _____ ______ ____ _____');
  await roomOperation(phrase.code, p2, { type: 'join', name: 'Max' });
  await roomOperation(phrase.code, p1, { type: 'ready' });
  await roomOperation(phrase.code, p2, { type: 'ready' });
  await transaction((db) =>
    db.query(
      `update private.room_states set state=jsonb_set(jsonb_set(state,'{match,phase}','"active"'),'{match,startsAt}',to_jsonb((extract(epoch from clock_timestamp())*1000-1000)::bigint)) where room_id=$1`,
      [phrase.id],
    ),
  );
  const submit = (word: string) =>
    roomOperation(phrase.code, p1, {
      type: 'guess',
      word,
      matchId: phrase.match.id,
      requestId: randomUUID(),
    });
  const accepted = await submit('CAPTION BREAK MOTHER THEN WORLD');
  expect(accepted.players[0].count).toBe(1);
  expect(accepted.players[0].attempts?.[0].word).toBe(
    'CAPTIONBREAKMOTHERTHENWORLD',
  );
  expect(accepted.players[0].attempts?.[0].marks).toHaveLength(27);
  await expect(submit('ACTIONS NIFFS LOUDER THAN WORDS')).rejects.toMatchObject(
    {
      status: 422,
      message: 'Word 2 is not in word list',
    },
  );
  await expect(submit('ACTIONS ZZZZZ LOUDER THAN WORDS')).rejects.toThrow(
    'Word 2 is not in word list',
  );
  await expect(submit('ZZZZZZZ SPEAK ZZZZZZ THAN WORDS')).rejects.toThrow(
    'Words 1 and 3 are not in word list',
  );
  await expect(submit('ZZZZZZZ ZZZZZ ZZZZZZ THAN WORDS')).rejects.toThrow(
    'Words 1, 2, and 3 are not in word list',
  );
  const reloaded = await roomOperation(phrase.code, p1);
  expect(reloaded.players[0].attempts).toEqual(accepted.players[0].attempts);
  expect(reloaded.players[0].count).toBe(1);
  expect(reloaded.players[0].timerEndsAt).toBe(accepted.players[0].timerEndsAt);
  const persisted = await transaction((db) =>
    db.query<{ word: string }>(
      'select word from public.guess_attempts where match_id=$1',
      [phrase.match.id],
    ),
  );
  expect(persisted).toEqual([{ word: 'CAPTIONBREAKMOTHERTHENWORLD' }]);
  const friend = await roomOperation(phrase.code, p2);
  expect(friend.players[0]).not.toHaveProperty('attempts');
  expect(friend.match).not.toHaveProperty('answer');
  const finished = await submit('ACTIONS SPEAK LOUDER THAN WORDS');
  expect(finished.match).toMatchObject({
    phase: 'complete',
    outcome: 'team-win',
    answer: 'ACTIONS SPEAK LOUDER THAN WORDS',
  });
  const rows = await transaction((db) =>
    db.query<{ game: string; word: string; count: number }>(
      `select game,word,jsonb_array_length(marks) as count from public.guess_attempts where match_id=$1 order by attempt`,
      [phrase.match.id],
    ),
  );
  expect(rows).toHaveLength(2);
  expect(rows[1]).toMatchObject({
    game: 'phrases',
    count: 27,
    word: 'ACTIONSSPEAKLOUDERTHANWORDS',
  });
  await roomOperation(phrase.code, p1, { type: 'rematch' });
  const next = await roomOperation(phrase.code, p2, { type: 'rematch' });
  expect(next.game).toBe('phrases');
  expect(next.match.phraseTemplate).toBe("_ _______ ___'_ ______ ___ _____");
  expect(next.players.every((p) => p.count === 0)).toBe(true);
  expect((await roomOperation(words.code, p1)).match).toMatchObject({
    id: words.match.id,
    phase: 'lobby',
  });
});
it('migration is repeatable and preserves the Words-only five-letter constraint', async () => {
  const db = await (
    globalThis as typeof globalThis & {
      __letterlaneDB: { local: Promise<PGlite> };
    }
  ).__letterlaneDB.local;
  const sql = await readFile(
    'supabase/migrations/202609220001_phrases.sql',
    'utf8',
  );
  await db.exec(sql);
  await db.exec(sql);
  const [row] = await db
    .query<{ definition: string }>(
      "select pg_get_constraintdef(oid) as definition from pg_constraint where conname='guess_attempts_puzzle_check'",
    )
    .then((result) => result.rows);
  expect(row.definition).toContain('words');
  const created = await createRoom(randomUUID(), 'Tester', 'duel');
  await expect(
    transaction((tx) =>
      tx.query(
        `insert into public.guess_attempts(match_id,player_id,attempt,word,marks,elapsed_ms,request_id,game) values($1,$2,1,'TOOLONG','["absent","absent","absent","absent","absent","absent","absent"]',0,$3,'words')`,
        [created.match.id, created.selfId, randomUUID()],
      ),
    ),
  ).rejects.toThrow();
});
