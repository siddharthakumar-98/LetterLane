import { z } from 'zod';
import { GameError } from './types';
export const nameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a display name.')
  .max(20, 'Keep your name to 20 characters.')
  .regex(
    /^[\p{L}\p{N} _.'-]+$/u,
    'Use letters, numbers, spaces, or simple punctuation.',
  );
export const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/, 'Enter the six-character room code.');
export const createSchema = z
  .object({
    name: nameSchema,
    mode: z.enum(['duel', 'coop']),
    game: z.enum(['words', 'phrases']).default('words'),
    botDifficulty: z.enum(['easy', 'medium', 'hard']).default('hard'),
  })
  .strict();
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), name: nameSchema }).strict(),
  z.object({ type: z.literal('ready') }).strict(),
  z.object({ type: z.literal('rematch') }).strict(),
  z.object({ type: z.literal('heartbeat') }).strict(),
  z
    .object({
      type: z.literal('guess'),
      word: z.string().max(256),
      requestId: z.uuid(),
      matchId: z.uuid(),
    })
    .strict(),
]);
export function validateGuess(value: string, allowed: ReadonlySet<string>) {
  const word = value.trim().toUpperCase();
  if (!/^[A-Z]{5}$/.test(word))
    throw new GameError('Your guess needs exactly five letters.', 422);
  if (!allowed.has(word))
    throw new GameError(
      'That word is not in our dictionary. Try another.',
      422,
    );
  return word;
}
