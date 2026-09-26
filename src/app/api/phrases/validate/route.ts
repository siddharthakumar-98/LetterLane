import { z } from 'zod';
import { isAllowedPhraseWord, MAX_PHRASE_WORDS } from '@/lib/game/phrases';
import { getPlayerId } from '@/lib/server/auth';
import { transaction } from '@/lib/server/db';
import { checkOrigin, failure, json, readBody } from '@/lib/server/http';
import { PHRASE_WORDS } from '@/lib/server/phrases';
import { rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';
const schema = z
  .object({
    words: z.array(z.string().min(1).max(64)).min(1).max(MAX_PHRASE_WORDS),
  })
  .strict();

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { words } = schema.parse(await readBody(request));
    const id = await getPlayerId(request);
    await transaction((db) => rateLimit(db, `phrase-validation:${id}`, 60, 60));
    // No room or answer is consulted; results describe only submitted words.
    return json({
      valid: words.map((word) => isAllowedPhraseWord(word, PHRASE_WORDS)),
    });
  } catch (error) {
    return failure(error);
  }
}
