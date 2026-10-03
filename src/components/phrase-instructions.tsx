import type { PhraseDifficulty } from '@/lib/game/types';
import { PHRASE_LEVELS } from '@/lib/game/phrase-difficulty';

export function PhraseInstructions({
  difficulty = 'normal',
}: {
  difficulty?: PhraseDifficulty;
}) {
  return (
    <div className="phrase-instructions">
      <p>
        {PHRASE_LEVELS[difficulty].label} phrases contain up to{' '}
        {PHRASE_LEVELS[difficulty].maxWords} words. Your goal is to guess the
        missing phrase. Enter words to see if you can guess it, and you’ll see
        colored boxes that will give you hints:
      </p>
      <div className="legend-list">
        <div>
          <span className="tile correct" aria-hidden="true">
            A
          </span>
          <p>
            <strong>Green:</strong> the right letter in the right spot.
          </p>
        </div>
        <div>
          <span className="tile present" aria-hidden="true">
            B
          </span>
          <p>
            <strong>Orange:</strong> the correct letter in that word, but in the
            wrong spot.
          </p>
        </div>
        <div>
          <span className="tile elsewhere" aria-hidden="true">
            C
          </span>
          <p>
            <strong>Blue:</strong> the letter is in another word of the phrase.
          </p>
        </div>
        <div>
          <span className="tile absent" aria-hidden="true">
            D
          </span>
          <p>
            <strong>Grey:</strong> the letter does not exist in the phrase, or
            all its occurrences have already been matched.
          </p>
        </div>
      </div>
      <p>
        Fill every letter in the displayed word lengths. Spaces and punctuation
        are automatic. Each word must be in the word list. You have six phrase
        guesses. Repeated letters receive hints only as many times as they occur
        in the answer.
      </p>
      <p>
        You each start with 3:00. Each green, orange, or blue tile earns five
        seconds. Your clock keeps running if you disconnect. The first solver
        wins a duel; either player can win for the team in co-op.
      </p>
    </div>
  );
}
