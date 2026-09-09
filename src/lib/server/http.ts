import 'server-only';
import { ZodError } from 'zod';
import { GameError } from '../game/types';
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).host !== request.headers.get('host'))
    throw new GameError(
      'This request could not be verified. Refresh and try again.',
      403,
    );
}
export async function readBody(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new GameError('Please send a valid game action.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new GameError('Please send a valid game action.', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) {
        await reader.cancel();
        throw new GameError('That request is too large.', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GameError('Please send a valid game action.', 400);
  }
}
export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      Vary: 'Cookie, Authorization',
    },
  });
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return json(
      { error: error.issues[0]?.message || 'Check your entry and try again.' },
      422,
    );
  if (error instanceof GameError)
    return json({ error: error.message }, error.status);
  // Do not log database errors, queries, room state, or answers.
  return json(
    { error: 'The game server hit a snag. Please try again in a moment.' },
    503,
  );
}
