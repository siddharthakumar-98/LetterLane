import 'server-only';
import { phraseWords, scorePhrase } from '../game/phrases';
import type { Attempt, BotDifficulty } from '../game/types';
import { chooseBotGuess } from './bot-strategy';
import { PHRASE_WORDS_BY_LENGTH } from './phrases';

/** Public word lengths and this bot's own marks only; never receives an answer. */
export function choosePhraseBotGuess(
  template: string,
  attempts: Attempt[],
  randomIndex: (length: number) => number,
  difficulty: BotDifficulty,
) {
  return phraseWords(template)
    .map((word) => {
      const history = attempts.map((attempt) => ({
        word: attempt.word.slice(word.offset, word.offset + word.length),
        marks: attempt.marks
          .slice(word.offset, word.offset + word.length)
          .map((mark) => (mark === 'elsewhere' ? ('absent' as const) : mark)),
      }));
      // A solved word must stay fixed while the rest of the phrase is explored.
      const solved = history.find((attempt) =>
        attempt.marks.every((mark) => mark === 'correct'),
      );
      if (solved) return solved.word;
      const vocabulary = PHRASE_WORDS_BY_LENGTH.get(word.length);
      if (!vocabulary?.length)
        throw new Error('No phrase words for this length.');
      return chooseBotGuess(
        history,
        vocabulary,
        randomIndex,
        difficulty,
        scorePhrase,
      );
    })
    .join('');
}
