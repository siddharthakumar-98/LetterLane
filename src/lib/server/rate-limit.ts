import 'server-only';
import type { DB } from './db';
import { GameError } from '../game/types';

export async function rateLimit(
  db: DB,
  key: string,
  max: number,
  seconds: number,
) {
  const [row] = await db.query<{ hits: number }>(
    `insert into private.rate_limits(key,window_start,hits) values($1,clock_timestamp(),1)
  on conflict(key) do update set hits=case when private.rate_limits.window_start < clock_timestamp()-($2 * interval '1 second') then 1 else private.rate_limits.hits+1 end,
  window_start=case when private.rate_limits.window_start < clock_timestamp()-($2 * interval '1 second') then clock_timestamp() else private.rate_limits.window_start end returning hits`,
    [key, seconds],
  );
  if (row.hits > max)
    throw new GameError('A little too fast. Wait a moment and try again.', 429);
}
