import 'server-only';
import { scoreGuess } from '../game/scoring';
import type { Attempt, BotDifficulty, Mark } from '../game/types';
import { BOT_PROFILES } from '../game/bot-difficulty';

type Feedback = Pick<Attempt, 'word' | 'marks'>;

/** The strategy receives vocabulary and its own feedback, never the hidden answer. */
export function chooseBotGuess(
  attempts: readonly Feedback[],
  vocabulary: readonly string[],
  randomIndex: (length: number) => number,
  difficulty: BotDifficulty = 'hard',
  evaluate: (answer: string, guess: string) => Mark[] = scoreGuess,
): string {
  const used = new Set(attempts.map((attempt) => attempt.word));
  const available = vocabulary.filter((word) => !used.has(word));
  if (available.length === 0) throw new Error('Bot vocabulary is exhausted.');
  const consistent = available.filter((candidate) =>
    attempts.every((attempt) =>
      evaluate(candidate, attempt.word).every(
        (mark, i) => mark === attempt.marks[i],
      ),
    ),
  );
  // An existing match may outlive a vocabulary update: keep making valid guesses.
  const candidates = consistent.length ? consistent : available;
  const frequencies = new Map<string, number>();
  for (const word of candidates) {
    for (const letter of new Set(word)) {
      frequencies.set(letter, (frequencies.get(letter) ?? 0) + 1);
    }
  }
  const information = (word: string) =>
    [...new Set(word)].reduce(
      (sum, letter) => sum + (frequencies.get(letter) ?? 0),
      0,
    );
  const ranked = candidates
    .map((word) => ({ word, score: information(word) }))
    .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
  // Variation among useful candidates keeps the bot from repeating one script.
  // Easier bots consider a wider range of words instead of favoring only
  // the most informative guesses. Every level still respects its own clues.
  const shortlist = ranked.slice(0, BOT_PROFILES[difficulty].shortlistSize);
  return shortlist[randomIndex(shortlist.length)].word;
}
