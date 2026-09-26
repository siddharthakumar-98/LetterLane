import 'server-only';
import { randomInt } from 'node:crypto';
import proverbs from './phrases/proverbs.json';
import dictionary from './phrases/allowed-words.json';
import { phraseEntry, phraseWords, playableLetters } from '../game/phrases';

export const PHRASE_COLLECTIONS = [proverbs];
const seen = new Set<string>();
export const PHRASES = PHRASE_COLLECTIONS.flatMap((collection) =>
  collection.phrases.flatMap((text) => {
    const entry = phraseEntry(text, collection.id);
    const key = playableLetters(text);
    if (!entry || seen.has(key)) return [];
    seen.add(key);
    return [entry];
  }),
);
// Phrases uses a conservative vocabulary, separate from the Words game lexicon.
// Contractions and every collection's answer vocabulary remain guessable.
const contractions = [
  "AREN'T",
  "CAN'T",
  "COULDN'T",
  "DIDN'T",
  "DOESN'T",
  "DON'T",
  "HADN'T",
  "HASN'T",
  "HAVEN'T",
  "ISN'T",
  "IT'S",
  "LET'S",
  "SHOULDN'T",
  "THAT'S",
  "THERE'S",
  "THEY'RE",
  "WASN'T",
  "WE'RE",
  "WEREN'T",
  "WHAT'S",
  "WON'T",
  "WOULDN'T",
  "YOU'RE",
  "YOU'VE",
];
export const PHRASE_WORDS: ReadonlySet<string> = new Set([
  ...dictionary,
  ...contractions.map(playableLetters),
  ...PHRASES.flatMap((phrase) =>
    phraseWords(phrase.text).map((word) => playableLetters(word.pattern)),
  ),
]);
export const PHRASE_WORDS_BY_LENGTH = new Map<number, string[]>();
for (const word of PHRASE_WORDS) {
  const group = PHRASE_WORDS_BY_LENGTH.get(word.length) ?? [];
  group.push(word);
  PHRASE_WORDS_BY_LENGTH.set(word.length, group);
}
export function pickPhrase(previous?: string) {
  if (
    process.env.E2E_TEST_MODE === '1' &&
    process.env.GAME_BACKEND === 'local' &&
    !process.env.VERCEL
  )
    return previous === 'ACTIONS SPEAK LOUDER THAN WORDS'
      ? "A LEOPARD CAN'T CHANGE ITS SPOTS"
      : 'ACTIONS SPEAK LOUDER THAN WORDS';
  const options = PHRASES.filter((phrase) => phrase.text !== previous);
  if (!options.length) throw new Error('No phrases available.');
  return options[randomInt(options.length)].text;
}
