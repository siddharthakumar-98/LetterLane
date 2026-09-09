'use client';
import { Delete, CornerDownLeft } from 'lucide-react';
import { keyboardMarks } from '@/lib/game/scoring';
import type { Attempt } from '@/lib/game/types';
export function Keyboard({
  attempts,
  onKey,
  disabled,
}: {
  attempts: Attempt[];
  onKey: (key: string) => void;
  disabled: boolean;
}) {
  const marks = keyboardMarks(attempts);
  return (
    <div className="keyboard" role="group" aria-label="Letter keyboard">
      {['QWERTYUIOP', 'ASDFGHJKL', '↵ZXCVBNM⌫'].map((row, i) => (
        <div className="keyboard-row" key={i}>
          {[...row].map((key) => (
            <button
              key={key}
              type="button"
              className={`key ${marks[key] ?? ''} ${key === '↵' || key === '⌫' ? 'wide' : ''}`}
              disabled={disabled}
              aria-label={
                key === '↵'
                  ? 'Submit guess'
                  : key === '⌫'
                    ? 'Delete letter'
                    : `${key}${marks[key] ? `, ${marks[key]}` : ''}`
              }
              onClick={(event) => {
                onKey(key === '↵' ? 'Enter' : key === '⌫' ? 'Backspace' : key);
                if (event.detail > 0) event.currentTarget.blur();
              }}
            >
              {key === '↵' ? (
                <>
                  <span className="enter-text">Enter</span>
                  <CornerDownLeft size={17} />
                </>
              ) : key === '⌫' ? (
                <Delete size={20} />
              ) : (
                key
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
