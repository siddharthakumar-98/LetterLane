import type { Mark } from './types';
/** Consume exact matches before allocating remaining occurrences left to right. */
export function scoreGuess(answer: string, guess: string): Mark[] {
  if (
    !/^[A-Z]{5,7}$/.test(answer) ||
    !/^[A-Z]{5,7}$/.test(guess) ||
    answer.length !== guess.length
  )
    throw new Error(
      'Scoring requires equally sized words of five to seven uppercase letters.',
    );
  const marks: Mark[] = Array<Mark>(answer.length).fill('absent');
  const remaining = new Map<string, number>();
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'correct';
    else remaining.set(answer[i], (remaining.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < answer.length; i++) {
    if (marks[i] === 'correct') continue;
    const count = remaining.get(guess[i]) ?? 0;
    if (count > 0) {
      marks[i] = 'present';
      remaining.set(guess[i], count - 1);
    }
  }
  return marks;
}
export function keyboardMarks(attempts: { word: string; marks: Mark[] }[]) {
  const weights = { absent: 0, elsewhere: 1, present: 2, correct: 3 };
  const result: Record<string, Mark> = {};
  for (const a of attempts)
    [...a.word].forEach((letter, i) => {
      if (
        result[letter] === undefined ||
        weights[a.marks[i]] > weights[result[letter]]
      )
        result[letter] = a.marks[i];
    });
  return result;
}
