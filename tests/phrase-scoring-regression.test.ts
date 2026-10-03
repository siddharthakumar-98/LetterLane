import { expect, it } from 'vitest';
import {
  phraseWords,
  playableLetters,
  scorePhrase,
} from '../src/lib/game/phrases';
import { scoreGuess } from '../src/lib/game/scoring';
import type { Mark } from '../src/lib/game/types';

// Positional reference implementation: consume actual answer occurrences.
function reference(answer: string, guess: string): Mark[] {
  const letters = [...playableLetters(answer)];
  const entered = [...playableLetters(guess)];
  const wordAt = phraseWords(answer).flatMap((word, index) =>
    Array<number>(word.length).fill(index),
  );
  const used = new Set<number>();
  const marks: Mark[] = letters.map((letter, i) => {
    if (letter !== entered[i]) return 'absent';
    used.add(i);
    return 'correct';
  });
  for (const sameWord of [true, false]) {
    entered.forEach((letter, i) => {
      if (marks[i] !== 'absent') return;
      const index = letters.findIndex(
        (candidate, j) =>
          candidate === letter &&
          !used.has(j) &&
          (wordAt[i] === wordAt[j]) === sameWord,
      );
      if (index >= 0) {
        used.add(index);
        marks[i] = sameWord ? 'present' : 'elsewhere';
      }
    });
  }
  return marks;
}

it('preserves positional scoring across 2,000 duplicate-heavy phrases and punctuation', () => {
  let seed = 42;
  const random = (max: number) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % max;
  };
  for (let sample = 0; sample < 2000; sample++) {
    const words = Array.from({ length: 1 + random(7) }, () =>
      Array.from({ length: 1 + random(15) }, () => 'ABCDE'[random(5)]).join(''),
    );
    const answer = words.join(sample % 2 ? ' ' : ', ');
    const guess = Array.from(
      { length: playableLetters(answer).length },
      () => 'ABCDEZ'[random(6)],
    ).join('');
    expect(scorePhrase(answer, guess)).toEqual(reference(answer, guess));
  }
});
it.each(['CRANE', 'BLOOM', 'GARDEN', 'JOURNEY'])(
  'retains Words scoring for single-word phrase bot candidates: %s',
  (answer) => {
    for (const guess of [
      answer,
      [...answer].reverse().join(''),
      'A'.repeat(answer.length),
    ])
      expect(scorePhrase(answer, guess)).toEqual(scoreGuess(answer, guess));
  },
);
