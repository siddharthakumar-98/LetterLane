import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  answersForLength,
  wordsForLength,
  pickAnswer,
} from '../src/lib/server/words';
import ordinaryWords from '../src/lib/server/phrases/allowed-words.json';
import { WORD_LENGTHS } from '../src/lib/game/word-length';
import { createSchema, validateGuess } from '../src/lib/game/validation';
import { scoreGuess } from '../src/lib/game/scoring';
import { applyAction, projectRoom } from '../src/lib/game/rules';
import { advanceBots } from '../src/lib/server/bots';
import { fixture, p1 } from './fixtures';

it.each(WORD_LENGTHS)(
  'keeps every %i-letter answer valid and selects only that length',
  (length) => {
    const answers = answersForLength(length);
    const allowed = wordsForLength(length);
    expect(answers.length).toBeGreaterThan(200);
    expect(new Set(answers).size).toBe(answers.length);
    for (const word of answers) {
      expect(word).toMatch(new RegExp(`^[A-Z]{${length}}$`));
      expect(validateGuess(word, allowed, length)).toBe(word);
    }
    for (const word of allowed)
      expect(word).toMatch(new RegExp(`^[A-Z]{${length}}$`));
    if (length !== 5) {
      expect([...allowed]).toEqual(
        ordinaryWords.filter((word) => word.length === length),
      );
    }
    for (let i = 0; i < 20; i++) {
      const chosen = pickAnswer(answers[0], length);
      expect(answers).toContain(chosen);
      expect(chosen).not.toBe(answers[0]);
    }
  },
);
it('validates length choices and defaults old clients to five letters', () => {
  const input = { name: 'Ada', mode: 'duel' };
  expect(createSchema.parse(input).wordLength).toBe(5);
  for (const wordLength of WORD_LENGTHS)
    expect(createSchema.parse({ ...input, wordLength }).wordLength).toBe(
      wordLength,
    );
  for (const wordLength of [4, 8, 6.5, '6', null])
    expect(createSchema.safeParse({ ...input, wordLength }).success).toBe(
      false,
    );
  expect(projectRoom(fixture(), p1, 1000).wordLength).toBe(5);
});
it.each([6, 7] as const)(
  'rejects malformed, unknown and wrong-length %i-letter guesses',
  (length) => {
    const allowed = wordsForLength(length);
    const valid = length === 6 ? 'garden' : 'journey';
    expect(validateGuess(` ${valid} `, allowed, length)).toBe(
      valid.toUpperCase(),
    );
    for (const word of [
      'CRANE',
      'ZZZZZZ',
      'ZZZZZZZ',
      'GARDEN!',
      '1234567',
      'ABC DEF',
    ]) {
      expect(() => validateGuess(word, allowed, length)).toThrow();
    }
    // Ordinary-language vocabulary, not specialist word-game tiers.
    for (const word of ['BAUKED', 'NIFFED', 'ZYZZYVA', 'QINDARS'])
      expect(allowed.has(word)).toBe(false);
  },
);
it('accounts for duplicate letters at both new lengths', () => {
  expect(scoreGuess('BANANA', 'ANANAS')).toEqual([
    'present',
    'present',
    'present',
    'present',
    'present',
    'absent',
  ]);
  expect(scoreGuess('BALLOON', 'LAGOONS')).toEqual([
    'present',
    'correct',
    'absent',
    'present',
    'correct',
    'present',
    'absent',
  ]);
  expect(() => scoreGuess('GARDEN', 'CRANE')).toThrow();
  expect(() => scoreGuess('ELEPHANT', 'ELEPHANT')).toThrow();
});
for (const length of [6, 7] as const) {
  it(`rejects invalid ${length}-letter submissions without consuming a guess or awarding time`, () => {
    const room = fixture();
    room.wordLength = length;
    room.match.answer = length === 6 ? 'GARDEN' : 'JOURNEY';
    const before = projectRoom(room, p1, 1100).players[0];
    for (const word of ['CRANE', 'Z'.repeat(length)]) {
      expect(() =>
        applyAction(
          room,
          p1,
          {
            type: 'guess',
            word,
            requestId: randomUUID(),
            matchId: room.match.id,
          },
          1100,
          wordsForLength(length),
          () => room.match.answer,
          randomUUID,
        ),
      ).toThrow();
    }
    const after = projectRoom(room, p1, 1100).players[0];
    expect(after.attempts).toEqual(before.attempts);
    expect(after.timerEndsAt).toBe(before.timerEndsAt);
  });
  it.each(['easy', 'medium', 'hard'] as const)(
    `uses valid ${length}-letter bot guesses on %s difficulty`,
    (difficulty) => {
      const room = fixture();
      room.wordLength = length;
      room.botDifficulty = difficulty;
      room.match.answer = length === 6 ? 'GARDEN' : 'JOURNEY';
      room.players[1].isBot = true;
      room.botNextGuessAt = 1100;
      advanceBots(room, 1100, {
        id: randomUUID,
        randomIndex: () => 0,
        thinkMs: () => 1000,
        nextAnswer: () => room.match.answer,
      });
      const attempt = room.players[1].attempts[0];
      expect(attempt.word).toHaveLength(length);
      expect(wordsForLength(length).has(attempt.word)).toBe(true);
      expect(attempt.marks).toEqual(
        scoreGuess(room.match.answer, attempt.word),
      );
      expect(projectRoom(room, p1, 1100).players[1]).not.toHaveProperty(
        'attempts',
      );
    },
  );
}
