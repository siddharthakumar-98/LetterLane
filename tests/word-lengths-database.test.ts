import { beforeAll, afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createRoom, roomOperation } from '../src/lib/server/rooms';
import { transaction } from '../src/lib/server/db';
import { scoreGuess } from '../src/lib/game/scoring';
let folder: string;
const runtime = () =>
  (
    globalThis as typeof globalThis & {
      __letterlaneDB: { local?: Promise<PGlite> };
    }
  ).__letterlaneDB;
beforeAll(async () => {
  folder = await mkdtemp(path.join(tmpdir(), 'letterlane-lengths-'));
  process.env.GAME_BACKEND = 'local';
  process.env.LOCAL_DATA_DIR = folder;
  process.env.E2E_TEST_MODE = '1';
});
afterAll(async () => {
  await (await runtime().local)?.close();
  await rm(folder, { recursive: true, force: true });
});
it.each([6, 7] as const)(
  'persists %i-letter co-op rooms, rejects invalid attempts and keeps the length through restart/rematch',
  async (length) => {
    const owner = randomUUID(),
      friend = randomUUID();
    const answer = length === 6 ? 'GARDEN' : 'JOURNEY';
    const guess = length === 6 ? 'BRIDGE' : 'PICTURE';
    const room = await createRoom(
      owner,
      'Ada',
      'coop',
      'medium',
      'words',
      length,
    );
    expect(room.wordLength).toBe(length);
    expect(room.match).not.toHaveProperty('answer');
    const joined = await roomOperation(room.code, friend, {
      type: 'join',
      name: 'Max',
    });
    expect(joined.wordLength).toBe(length);
    await roomOperation(room.code, owner, { type: 'ready' });
    await roomOperation(room.code, friend, { type: 'ready' });
    await transaction((db) =>
      db.query(
        `update private.room_states set state=jsonb_set(jsonb_set(state,'{match,phase}','"active"'),'{match,startsAt}',to_jsonb((extract(epoch from clock_timestamp())*1000-1000)::bigint)) where room_id=$1`,
        [room.id],
      ),
    );
    const submit = (word: string) =>
      roomOperation(room.code, owner, {
        type: 'guess',
        word,
        matchId: room.match.id,
        requestId: randomUUID(),
      });
    const before = await roomOperation(room.code, owner);
    for (const word of ['CRANE', 'Z'.repeat(length)])
      await expect(submit(word)).rejects.toMatchObject({ status: 422 });
    const rejected = await roomOperation(room.code, owner);
    expect(rejected.players[0].count).toBe(0);
    expect(rejected.players[0].timerEndsAt).toBe(before.players[0].timerEndsAt);
    expect(
      await transaction((db) =>
        db.query('select word from public.guess_attempts where match_id=$1', [
          room.match.id,
        ]),
      ),
    ).toEqual([]);
    const accepted = await submit(guess);
    expect(accepted.players[0].attempts?.[0].marks).toEqual(
      scoreGuess(answer, guess),
    );
    expect(accepted.players[0].timerEndsAt).toBe(
      before.players[0].timerEndsAt! +
        scoreGuess(answer, guess).filter((m) => m !== 'absent').length * 20000,
    );
    const other = await roomOperation(room.code, friend);
    expect(other.players[0]).not.toHaveProperty('attempts');
    expect(other.players[0].guessMarks[0]).toHaveLength(length);
    // A real local DB restart must not reapply the old five-letter constraint.
    await (await runtime().local)!.close();
    runtime().local = undefined;
    const restored = await roomOperation(room.code, owner);
    expect(restored.wordLength).toBe(length);
    expect(restored.players[0].attempts).toEqual(accepted.players[0].attempts);
    const complete = await submit(answer);
    expect(complete.match).toMatchObject({
      phase: 'complete',
      outcome: 'team-win',
      answer,
    });
    await roomOperation(room.code, owner, { type: 'rematch' });
    const next = await roomOperation(room.code, friend, { type: 'rematch' });
    expect(next.wordLength).toBe(length);
    expect(next.match.round).toBe(2);
    expect(next.players.every((p) => p.count === 0)).toBe(true);
    const [stored] = await transaction((db) =>
      db.query<{ answer: string }>(
        "select state->'match'->>'answer' as answer from private.room_states where room_id=$1",
        [room.id],
      ),
    );
    expect(stored.answer).toBe(guess);
  },
);
it('reapplies the new constraint safely and rejects invalid shapes and mismatched mark counts', async () => {
  const db = (await runtime().local)!;
  const sql = await readFile(
    'supabase/migrations/202609290001_word_lengths.sql',
    'utf8',
  );
  await db.exec(sql);
  await db.exec(sql);
  const room = await createRoom(randomUUID(), 'Tester', 'duel');
  for (const word of ['FOUR', 'TOOLONGS', 'GARD3N', 'garden', 'GARDEN']) {
    await expect(
      transaction((tx) =>
        tx.query(
          `insert into public.guess_attempts(match_id,player_id,attempt,word,marks,elapsed_ms,request_id,game) values($1,$2,1,$3,$4::text::jsonb,0,$5,'words')`,
          [
            room.match.id,
            room.selfId,
            word,
            JSON.stringify(
              Array(word === 'GARDEN' ? 5 : word.length).fill('absent'),
            ),
            randomUUID(),
          ],
        ),
      ),
    ).rejects.toThrow();
  }
});
