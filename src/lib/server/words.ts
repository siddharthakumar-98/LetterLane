import 'server-only';
import { randomInt } from 'node:crypto';
import answers from './dictionary/answers.json';
import allowed from './dictionary/allowed-guesses.json';
export const ANSWERS: readonly string[] = answers;
export const ALLOWED_WORDS: ReadonlySet<string> = new Set(allowed);
export function pickAnswer(previous?: string) {
  const options = ANSWERS.filter((w) => w !== previous);
  if (
    process.env.E2E_TEST_MODE === '1' &&
    process.env.GAME_BACKEND === 'local' &&
    !process.env.VERCEL
  )
    return previous === 'CRANE' ? 'BLOOM' : 'CRANE';
  return options[randomInt(options.length)];
}
