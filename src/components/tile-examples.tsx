import { scoreGuess } from '@/lib/game/scoring';
import { scorePhrase, playableLetters } from '@/lib/game/phrases';
import type { Mark } from '@/lib/game/types';

const wordNames: Record<Mark, string> = {
  correct: 'green',
  present: 'yellow',
  elsewhere: 'blue',
  absent: 'grey',
};
const phraseNames: Record<Mark, string> = { ...wordNames, present: 'orange' };

/** A Words guess scored by the real game rules. */
export function WordExample({
  answer,
  guess,
}: {
  answer: string;
  guess: string;
}) {
  const marks = scoreGuess(answer, guess);
  return (
    <div
      className="example-row"
      role="img"
      aria-label={`${guess}: ${[...guess].map((letter, i) => `${letter} ${wordNames[marks[i]]}`).join(', ')}`}
    >
      {[...guess].map((letter, i) => (
        <span key={i} className={`tile ${marks[i]}`} aria-hidden="true">
          {letter}
        </span>
      ))}
    </div>
  );
}

/** A Phrases guess scored by the real game rules, grouped by word. */
export function PhraseExample({
  answer,
  guess,
}: {
  answer: string;
  guess: string;
}) {
  const marks = scorePhrase(answer, playableLetters(guess));
  let index = 0;
  const words = guess
    .split(' ')
    .map((word) =>
      [...word].map((letter) => ({ letter, mark: marks[index++] })),
    );
  return (
    <div
      className="example-row example-phrase"
      role="img"
      aria-label={`${guess}: ${words
        .flat()
        .map(({ letter, mark }) => `${letter} ${phraseNames[mark]}`)
        .join(', ')}`}
    >
      {words.map((word, w) => (
        <span key={w} className="example-word" aria-hidden="true">
          {word.map(({ letter, mark }, i) => (
            <span key={i} className={`tile ${mark}`}>
              {letter}
            </span>
          ))}
        </span>
      ))}
    </div>
  );
}
