import { describe, it, expect } from 'vitest';
import { scoreGuess, keyboardMarks } from '../src/lib/game/scoring';
import {
  validateGuess,
  actionSchema,
  nameSchema,
  codeSchema,
} from '../src/lib/game/validation';
import { allowed } from './fixtures';
describe('letter scoring', () => {
  it.each([
    ['CRANE', 'CRANE', ['correct', 'correct', 'correct', 'correct', 'correct']],
    ['APPLE', 'ALLEY', ['correct', 'present', 'absent', 'present', 'absent']],
    ['APPLE', 'PAPAL', ['present', 'present', 'correct', 'absent', 'present']],
    ['EERIE', 'GEESE', ['absent', 'correct', 'present', 'absent', 'correct']],
    ['SHEEP', 'SPEED', ['correct', 'present', 'correct', 'correct', 'absent']],
    ['CRANE', 'JOLLY', ['absent', 'absent', 'absent', 'absent', 'absent']],
    ['LEVEL', 'ELLEE', ['present', 'present', 'present', 'correct', 'absent']],
  ])('%s against %s accounts for duplicates', (answer, guess, marks) =>
    expect(scoreGuess(answer, guess)).toEqual(marks),
  );
  it('never grants more marked occurrences than exist in the answer', () => {
    for (const answer of ['APPLE', 'EERIE', 'LEVEL', 'LLAMA', 'SASSY'])
      for (const guess of ['EEEEE', 'LLLLL', 'AAAAA', 'PAPAL', 'SASSY']) {
        const marks = scoreGuess(answer, guess);
        for (const letter of new Set(guess))
          expect(
            [...guess].filter((l, i) => l === letter && marks[i] !== 'absent')
              .length,
          ).toBeLessThanOrEqual([...answer].filter((l) => l === letter).length);
      }
  });
  it('keeps the strongest keyboard state', () =>
    expect(
      keyboardMarks([
        { word: 'APPLE', marks: scoreGuess('APPLE', 'APPLE') },
        { word: 'ALLEY', marks: scoreGuess('APPLE', 'ALLEY') },
      ]),
    ).toMatchObject({ A: 'correct', L: 'correct', E: 'correct', Y: 'absent' }));
});
describe('server input validation', () => {
  it('normalizes accepted words', () =>
    expect(validateGuess(' crane ', allowed)).toBe('CRANE'));
  it.each(['A', 'CRANES', 'CR4NE', 'ééééé', 'CR NE', '<img>', 'ZZZZZ'])(
    'rejects %s',
    (word) => expect(() => validateGuess(word, allowed)).toThrow(),
  );
  it('validates names and short codes', () => {
    expect(nameSchema.safeParse('  Ada  ').data).toBe('Ada');
    expect(nameSchema.safeParse('<script>').success).toBe(false);
    expect(codeSchema.parse('abcdef')).toBe('ABCDEF');
    expect(codeSchema.safeParse('000000').success).toBe(false);
  });
  it('rejects client scores and timestamps', () =>
    expect(
      actionSchema.safeParse({
        type: 'guess',
        word: 'CRANE',
        requestId: crypto.randomUUID(),
        matchId: crypto.randomUUID(),
        score: 5,
        elapsedMs: 1,
      }).success,
    ).toBe(false));
});
