import { afterEach, expect, it, vi } from 'vitest';
import { createSchema, actionSchema } from '../src/lib/game/validation';
import {
  PHRASES,
  phrasesForDifficulty,
  pickPhrase,
} from '../src/lib/server/phrases';
import { pickPuzzle } from '../src/lib/server/puzzles';
import { phraseMetadata } from '../src/lib/game/phrases';
import { projectRoom } from '../src/lib/game/rules';
import { fixture, p1 } from './fixtures';

afterEach(() => vi.unstubAllEnvs());
it('Easy is exactly the existing collection filtered to five words; Normal preserves the full collection', () => {
  const easy = phrasesForDifficulty('easy');
  expect(easy.length).toBeGreaterThan(10);
  expect(easy).toEqual(PHRASES.filter((p) => p.wordCount <= 5));
  expect(phrasesForDifficulty('normal')).toEqual(PHRASES);
  expect(phrasesForDifficulty()).toEqual(PHRASES);
  expect(PHRASES.some((p) => p.wordCount === 6)).toBe(true);
  expect(PHRASES.some((p) => p.wordCount === 7)).toBe(true);
});
it.each(['easy', 'normal'] as const)(
  'random %s puzzles obey the cap and exclude the previous answer',
  (difficulty) => {
    vi.stubEnv('E2E_TEST_MODE', '0');
    let previous: string | undefined;
    const pool = phrasesForDifficulty(difficulty).map((p) => p.text);
    for (let i = 0; i < 100; i++) {
      const answer = pickPhrase(previous, difficulty);
      expect(pool).toContain(answer);
      expect(answer).not.toBe(previous);
      previous = answer;
    }
  },
);
it('local deterministic fixtures follow the selected limit and preserve Normal fixtures', () => {
  vi.stubEnv('E2E_TEST_MODE', '1');
  vi.stubEnv('GAME_BACKEND', 'local');
  vi.stubEnv('VERCEL', '');
  const first = 'ACTIONS SPEAK LOUDER THAN WORDS';
  expect(pickPuzzle('phrases', undefined, 7, 'easy')).toBe(first);
  const easyNext = pickPuzzle('phrases', first, 7, 'easy');
  expect(easyNext).toBe('BETTER LATE THAN NEVER');
  expect(phraseMetadata(easyNext).wordCount).toBeLessThanOrEqual(5);
  expect(pickPuzzle('phrases', first)).toBe("A LEOPARD CAN'T CHANGE ITS SPOTS");
  expect(pickPuzzle('words', undefined, 7, 'easy')).toBe('JOURNEY');
});
it('validates difficulty only at creation and defaults legacy rooms to Normal', () => {
  const base = { name: 'Ada', mode: 'duel', game: 'phrases' };
  expect(createSchema.parse(base).phraseDifficulty).toBe('normal');
  for (const phraseDifficulty of ['easy', 'normal'])
    expect(
      createSchema.parse({ ...base, phraseDifficulty }).phraseDifficulty,
    ).toBe(phraseDifficulty);
  for (const phraseDifficulty of ['hard', 'medium', '', null, 5])
    expect(createSchema.safeParse({ ...base, phraseDifficulty }).success).toBe(
      false,
    );
  expect(
    actionSchema.safeParse({ type: 'ready', phraseDifficulty: 'easy' }).success,
  ).toBe(false);
  const room = fixture();
  expect(projectRoom(room, p1, 1000)).not.toHaveProperty('phraseDifficulty');
  room.game = 'phrases';
  room.match.answer = 'ACTIONS SPEAK LOUDER THAN WORDS';
  expect(projectRoom(room, p1, 1000).phraseDifficulty).toBe('normal');
  room.phraseDifficulty = 'easy';
  expect(projectRoom(room, p1, 1000).phraseDifficulty).toBe('easy');
});

it.each(['easy', 'medium', 'hard'] as const)(
  'keeps Easy phrases capped when a %s bot triggers the rematch',
  async (botDifficulty) => {
    const { advanceBots } = await import('../src/lib/server/bots');
    vi.stubEnv('E2E_TEST_MODE', '1');
    vi.stubEnv('GAME_BACKEND', 'local');
    vi.stubEnv('VERCEL', '');
    const room = fixture();
    room.game = 'phrases';
    room.phraseDifficulty = 'easy';
    room.botDifficulty = botDifficulty;
    room.match.answer = 'ACTIONS SPEAK LOUDER THAN WORDS';
    room.match.phase = 'complete';
    room.match.endedAt = 1100;
    room.players[0].rematch = true;
    room.players[1].isBot = true;
    advanceBots(room, 1200);
    expect(room.match.phase).toBe('countdown');
    expect(room.match.answer).toBe('BETTER LATE THAN NEVER');
    expect(room.phraseDifficulty).toBe('easy');
    expect(room.botDifficulty).toBe(botDifficulty);
  },
);
