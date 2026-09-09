import 'server-only';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { transaction, isLocal } from './db';
import { GameError } from '../game/types';
const hash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export async function getPlayerId(request: Request) {
  if (isLocal()) {
    const token = (await cookies()).get('letterlane_guest')?.value;
    if (!token)
      throw new GameError(
        'Your guest session is missing. Refresh to reconnect.',
        401,
      );
    const rows = await transaction((db) =>
      db.query<{ player_id: string }>(
        'select player_id from private.local_sessions where token_hash=$1 and expires_at > now()',
        [hash(token)],
      ),
    );
    if (!rows[0])
      throw new GameError(
        'Your guest session has expired. Refresh to reconnect.',
        401,
      );
    return rows[0].player_id;
  }
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) throw new GameError('Please reconnect your guest session.', 401);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Authentication is not configured.');
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user)
    throw new GameError(
      'Your guest session could not be verified. Refresh to reconnect.',
      401,
    );
  return data.user.id;
}
export async function createLocalSession(request: Request) {
  try {
    return await getPlayerId(request);
  } catch (error) {
    if (!(error instanceof GameError) || error.status !== 401) throw error;
  }
  const token = randomBytes(32).toString('base64url');
  const id = randomUUID();
  await transaction(async (db) => {
    await db.query(
      "insert into private.local_sessions(token_hash,player_id,expires_at) values($1,$2,now()+interval '30 days')",
      [hash(token), id],
    );
  });
  (await cookies()).set('letterlane_guest', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: new URL(request.url).protocol === 'https:',
    path: '/',
    maxAge: 30 * 86400,
  });
  return id;
}
