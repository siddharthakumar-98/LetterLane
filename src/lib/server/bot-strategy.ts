import 'server-only';
import { scoreGuess } from '../game/scoring';
import type { Attempt } from '../game/types';

type Feedback = Pick<Attempt, 'word' | 'marks'>;

/** The strategy receives vocabulary and its own feedback, never the hidden answer. */
export function chooseBotGuess(
  attempts: readonly Feedback[],
  vocabulary: readonly string[],
  randomIndex: (length: number) => number,
): string {
  const used = new Set(attempts.map((attempt) => attempt.word));
  const available = vocabulary.filter((word) => !used.has(word));
  if (available.length === 0) throw new Error('Bot vocabulary is exhausted.');
  const consistent = available.filter((candidate) =>
    attempts.every((attempt) =>
      scoreGuess(candidate, attempt.word).every(
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
  const shortlist = ranked.slice(0, Math.min(3, ranked.length));
  return shortlist[randomIndex(shortlist.length)].word;
}
