import { beforeAll, afterAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { createRoom, roomOperation } from '../src/lib/server/rooms';
import { transaction } from '../src/lib/server/db';
import { phraseMetadata } from '../src/lib/game/phrases';
let folder: string;
const runtime = () =>
  (
    globalThis as typeof globalThis & {
      __letterlaneDB: { local?: Promise<PGlite> };
    }
  ).__letterlaneDB;
beforeAll(async () => {
  folder = await mkdtemp(path.join(tmpdir(), 'letterlane-phrase-difficulty-'));
  process.env.GAME_BACKEND = 'local';
  process.env.LOCAL_DATA_DIR = folder;
  process.env.E2E_TEST_MODE = '1';
});
afterAll(async () => {
  await (await runtime().local)?.close();
  await rm(folder, { recursive: true, force: true });
});
it.each(['easy', 'normal'] as const)(
  'persists %s through joining, restart, valid/invalid guesses and human rematches',
  async (difficulty) => {
    const owner = randomUUID(),
      friend = randomUUID();
    const created = await createRoom(
      owner,
      'Ada',
      'coop',
      'medium',
      'phrases',
      5,
      difficulty,
    );
    expect(created.phraseDifficulty).toBe(difficulty);
    expect(created).not.toHaveProperty('wordLength');
    const joined = await roomOperation(created.code, friend, {
      type: 'join',
      name: 'Max',
    });
    expect(joined.phraseDifficulty).toBe(difficulty);
    await roomOperation(created.code, owner, { type: 'ready' });
    await roomOperation(created.code, friend, { type: 'ready' });
    await transaction((db) =>
      db.query(
        `update private.room_states set state=jsonb_set(jsonb_set(state,'{match,phase}','"active"'),'{match,startsAt}',to_jsonb((extract(epoch from clock_timestamp())*1000-1000)::bigint)) where room_id=$1`,
        [created.id],
      ),
    );
    const active = await roomOperation(created.code, owner);
    expect(active.players[0].timerEndsAt! - active.match.startsAt!).toBe(
      180000,
    );
    const submit = (word: string) =>
      roomOperation(created.code, owner, {
        type: 'guess',
        word,
        requestId: randomUUID(),
        matchId: created.match.id,
      });
    await expect(
      submit('ZZZZZZZ SPEAK LOUDER THAN WORDS'),
    ).rejects.toMatchObject({
      status: 422,
      message: 'Word 1 is not in word list',
    });
    const rejected = await roomOperation(created.code, owner);
    expect(rejected.players[0].count).toBe(0);
    expect(rejected.players[0].timerEndsAt).toBe(active.players[0].timerEndsAt);
    await (await runtime().local)!.close();
    runtime().local = undefined;
    expect((await roomOperation(created.code, owner)).phraseDifficulty).toBe(
      difficulty,
    );
    const complete = await submit('ACTIONS SPEAK LOUDER THAN WORDS');
    expect(complete.match.phase).toBe('complete');
    expect(
      complete.players[0].timerEndsAt! - active.players[0].timerEndsAt!,
    ).toBe(27 * 5000);
    await roomOperation(created.code, owner, { type: 'rematch' });
    const next = await roomOperation(created.code, friend, { type: 'rematch' });
    expect(next.phraseDifficulty).toBe(difficulty);
    expect(next.match.round).toBe(2);
    expect(phraseMetadata(next.match.phraseTemplate!).wordCount).toBe(
      difficulty === 'easy' ? 4 : 6,
    );
  },
);
it('keeps legacy Phrases rooms Normal and ignores phrase settings for Words', async () => {
  const owner = randomUUID();
  const phrase = await createRoom(owner, 'Ada', 'duel', 'medium', 'phrases');
  await transaction((db) =>
    db.query(
      "update private.room_states set state=state-'phraseDifficulty' where room_id=$1",
      [phrase.id],
    ),
  );
  expect((await roomOperation(phrase.code, owner)).phraseDifficulty).toBe(
    'normal',
  );
  const words = await createRoom(
    owner,
    'Ada',
    'duel',
    'medium',
    'words',
    7,
    'easy',
  );
  expect(words.wordLength).toBe(7);
  expect(words).not.toHaveProperty('phraseDifficulty');
  const [saved] = await transaction((db) =>
    db.query<{ state: Record<string, unknown> }>(
      'select state from private.room_states where room_id=$1',
      [words.id],
    ),
  );
  expect(saved.state).not.toHaveProperty('phraseDifficulty');
});
