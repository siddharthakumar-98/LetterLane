import { PhraseBoard } from './phrase-board';
import type { Attempt } from '@/lib/game/types';
export function Board({
  attempts,
  input = '',
  compact = false,
  label = 'Your guesses',
  template,
}: {
  attempts: Attempt[];
  input?: string;
  compact?: boolean;
  label?: string;
  template?: string;
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
      role="group"
      aria-label={label}
    >
      {Array.from({ length: 6 }, (_, row) => {
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
            {Array.from({ length: 5 }, (_, col) => (
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
}
export function MaskedBoard({ count }: { count: number }) {
  return (
    <div
      className="masked-board"
      role="img"
      aria-label={`Opponent has used ${count} of 6 guesses. Letters are hidden.`}
    >
      {Array.from({ length: 6 }, (_, row) => (
        <div className="masked-row" key={row}>
          <span className="row-number">0{row + 1}</span>
          <div>
            {Array.from({ length: 5 }, (_, col) => (
              <span
                key={col}
                className={`masked-tile ${row < count ? 'filled' : ''}`}
              />
            ))}
          </div>
          <span className="masked-state">{row < count ? 'Played' : '—'}</span>
        </div>
      ))}
    </div>
  );
}
