import { memo } from 'react';
import { PhraseBoard } from './phrase-board';
import type { Attempt, Mark, WordLength } from '@/lib/game/types';
import { phraseWords } from '@/lib/game/phrases';
export const Board = memo(function Board({
  attempts,
  input = '',
  compact = false,
  label = 'Your guesses',
  template,
  wordLength = 5,
  rows = 6,
}: {
  attempts: Attempt[];
  input?: string;
  compact?: boolean;
  label?: string;
  template?: string;
  wordLength?: WordLength;
  /** Words rows to render; Phrases manages its own rows. */
  rows?: number;
}) {
  if (template)
    return (
      <PhraseBoard
        template={template}
        attempts={attempts}
        input={input}
        compact={compact}
        label={label}
      />
    );
  return (
    <div
      className={`board ${compact ? 'compact' : ''}`}
      style={{ '--word-length': wordLength } as React.CSSProperties}
      role="group"
      aria-label={label}
    >
      {Array.from({ length: rows }, (_, row) => {
        const attempt = attempts[row];
        const letters = attempt?.word ?? (row === attempts.length ? input : '');
        return (
          <div
            role="group"
            className={`tile-row ${attempt ? 'revealed' : ''}`}
            key={row}
            aria-label={
              attempt
                ? `Guess ${row + 1}: ${attempt.word
                    .split('')
                    .map((letter, i) => `${letter} ${attempt.marks[i]}`)
                    .join(', ')}`
                : `Guess ${row + 1}, ${letters || 'empty'}`
            }
          >
            {Array.from({ length: wordLength }, (_, col) => (
              <div
                aria-hidden="true"
                style={
                  { '--tile-delay': `${col * 65}ms` } as React.CSSProperties
                }
                key={col}
                className={`tile ${attempt ? attempt.marks[col] : letters[col] ? 'typed' : ''}`}
              >
                {letters[col]}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
});
export const MaskedBoard = memo(function MaskedBoard({
  count,
  guessMarks = [],
  template,
  wordLength = 5,
  finished = false,
}: {
  count: number;
  guessMarks?: Mark[][];
  template?: string;
  wordLength?: WordLength;
  /** No further guesses are possible, so no next row is shown. */
  finished?: boolean;
}) {
  const words = template
    ? phraseWords(template)
    : [{ offset: 0, length: wordLength }];
  const colors: Record<Mark, string> = {
    correct: 'green',
    present: template ? 'orange' : 'yellow',
    elsewhere: 'blue',
    absent: 'grey',
  };
  return (
    <div
      className={`masked-board ${template ? 'masked-phrase-board' : ''}`}
      style={
        {
          '--masked-columns': Math.max(...words.map(({ length }) => length)),
        } as React.CSSProperties
      }
      role="group"
      aria-label={`Opponent has used ${count} of 6 guesses. Letters are hidden.`}
    >
      {/* Played rows plus one pending row; later rows appear as guesses arrive. */}
      {Array.from(
        { length: Math.min(6, count + (finished ? 0 : 1)) },
        (_, row) => (
          <div
            className={`masked-row ${row < count ? '' : 'is-next'}`}
            key={row}
            role="img"
            aria-label={`Opponent guess ${row + 1}: ${
              row < count
                ? guessMarks[row]?.map((mark) => colors[mark]).join(', ') ||
                  'played'
                : 'waiting'
            }`}
          >
            <span className="row-number">0{row + 1}</span>
            <div className="masked-tiles" aria-hidden="true">
              {words.map((word, index) => (
                <span className="masked-word" key={index}>
                  {Array.from({ length: word.length }, (_, col) => (
                    <span
                      key={col}
                      className={`masked-tile ${row < count ? (guessMarks[row]?.[word.offset + col] ?? 'filled') : ''}`}
                    />
                  ))}
                </span>
              ))}
            </div>
            <span className="masked-state">{row < count ? 'Played' : '—'}</span>
          </div>
        ),
      )}
    </div>
  );
});
