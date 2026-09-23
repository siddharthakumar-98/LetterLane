import type { CSSProperties } from 'react';
import type { Attempt, Mark } from '@/lib/game/types';
import { formatPhraseGuess, phraseWords } from '@/lib/game/phrases';

const markLabels: Record<Mark, string> = {
  correct: 'green, right spot',
  present: 'orange, elsewhere in this word',
  elsewhere: 'blue, in another word',
  absent: 'grey, no remaining match',
};
export function PhraseRow({
  template,
  letters,
  marks,
}: {
  template: string;
  letters: string;
  marks?: Mark[];
}) {
  const words = phraseWords(template);
  return (
    <div
      className="phrase-words"
      style={
        {
          '--phrase-columns': Math.max(
            ...words.map((word) => word.pattern.length),
          ),
        } as CSSProperties
      }
    >
      {words.map((word, wordIndex) => {
        let index = word.offset;
        return (
          <div
            className="phrase-word"
            role="group"
            key={wordIndex}
            aria-label={`Word ${wordIndex + 1}`}
          >
            {[...word.pattern].map((character, position) => {
              if (character !== '_' && !/[A-Z]/.test(character))
                return (
                  <span className="phrase-punctuation" key={position}>
                    {character}
                  </span>
                );
              const letterIndex = index++;
              return (
                <span
                  role={marks ? 'img' : undefined}
                  className={`tile ${marks?.[letterIndex] ?? (letters[letterIndex] ? 'typed' : '')}`}
                  key={position}
                  aria-label={
                    marks
                      ? `${letters[letterIndex]}: ${markLabels[marks[letterIndex]]}`
                      : undefined
                  }
                >
                  {letters[letterIndex]}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
export function PhraseBoard({
  template,
  attempts,
  input = '',
  compact = false,
  label = 'Your guesses',
}: {
  template: string;
  attempts: Attempt[];
  input?: string;
  compact?: boolean;
  label?: string;
}) {
  const complete = attempts.some((attempt) =>
    attempt.marks.every((mark) => mark === 'correct'),
  );
  const rows = Math.min(6, attempts.length + (complete || compact ? 0 : 1));
  return (
    <div
      className={`board phrase-board ${compact ? 'compact' : ''}`}
      role="group"
      aria-label={label}
    >
      {Array.from({ length: rows }, (_, row) => {
        const attempt = attempts[row];
        const letters = attempt?.word ?? input;
        return (
          <div
            className="phrase-guess"
            key={row}
            role="group"
            aria-label={`Guess ${row + 1}: ${letters ? formatPhraseGuess(template, letters) : 'empty'}`}
          >
            <span className="phrase-guess-label">GUESS {row + 1} OF 6</span>
            <PhraseRow
              template={template}
              letters={letters}
              marks={attempt?.marks}
            />
          </div>
        );
      })}
      {compact && !attempts.length && (
        <p className="muted">No guesses submitted.</p>
      )}
    </div>
  );
}
