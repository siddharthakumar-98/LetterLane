import 'server-only';
import { randomInt, randomUUID } from 'node:crypto';
import { transaction, databaseTime, type DB } from './db';
import { puzzleWords, pickPuzzle } from './puzzles';
import { applyAction, projectRoom } from '../game/rules';
import {
  GameError,
  type Action,
  type Mode,
  type Room,
  type BotDifficulty,
  type GameKind,
} from '../game/types';
import { advanceBots } from './bots';
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
async function rateLimit(db: DB, key: string, max: number, seconds: number) {
  const [row] = await db.query<{ hits: number }>(
    `insert into private.rate_limits(key,window_start,hits) values($1,clock_timestamp(),1)
  on conflict(key) do update set hits=case when private.rate_limits.window_start < clock_timestamp()-($2 * interval '1 second') then 1 else private.rate_limits.hits+1 end,
  window_start=case when private.rate_limits.window_start < clock_timestamp()-($2 * interval '1 second') then clock_timestamp() else private.rate_limits.window_start end returning hits`,
    [key, seconds],
  );
  if (row.hits > max)
    throw new GameError('A little too fast. Wait a moment and try again.', 429);
}
async function persist(db: DB, room: Room) {
  room.revision++;
  await db.query('update public.rooms set expires_at=$2 where id=$1', [
    room.id,
    new Date(room.expiresAt).toISOString(),
  ]);
  for (const [seat, p] of room.players.entries()) {
    await db.query(
      'insert into public.players(id,display_name,is_bot) values($1,$2,$3) on conflict(id) do update set display_name=excluded.display_name,is_bot=excluded.is_bot',
      [p.id, p.name, p.isBot ?? false],
    );
    await db.query(
      `insert into public.room_participants(room_id,player_id,seat,ready,last_seen) values($1,$2,$3,$4,$5)
      on conflict(room_id,player_id) do update set ready=excluded.ready,last_seen=excluded.last_seen`,
      [room.id, p.id, seat, p.ready, new Date(p.lastSeen).toISOString()],
    );
  }
  const m = room.match;
  await db.query(
    `insert into public.matches(id,room_id,round,phase,starts_at,ended_at,winner_id,outcome) values($1,$2,$3,$4,$5,$6,$7,$8)
    on conflict(id) do update set phase=excluded.phase,starts_at=excluded.starts_at,ended_at=excluded.ended_at,winner_id=excluded.winner_id,outcome=excluded.outcome`,
    [
      m.id,
      room.id,
      m.round,
      m.phase,
      m.startsAt === null ? null : new Date(m.startsAt).toISOString(),
      m.endedAt === null ? null : new Date(m.endedAt).toISOString(),
      m.winnerId,
      m.outcome,
    ],
  );
  for (const p of room.players) {
    for (const [i, a] of p.attempts.entries())
      await db.query(
        `insert into public.guess_attempts(match_id,player_id,attempt,word,marks,elapsed_ms,request_id,game) values($1,$2,$3,$4,$5::text::jsonb,$6,$7,$8) on conflict do nothing`,
        [
          m.id,
          p.id,
          i + 1,
          a.word,
          JSON.stringify(a.marks),
          a.elapsedMs,
          a.requestId,
          room.game ?? 'words',
        ],
      );
    await db.query(
      'insert into public.rematch_readiness(match_id,player_id,ready) values($1,$2,$3) on conflict(match_id,player_id) do update set ready=excluded.ready',
      [m.id, p.id, p.rematch],
    );
  }
  await db.query(
    // Bind pre-encoded JSON as text: Postgres.js otherwise JSON-encodes it again.
    'insert into private.room_states(room_id,state) values($1,$2::text::jsonb) on conflict(room_id) do update set state=excluded.state',
    [room.id, JSON.stringify(room)],
  );
  await db.query(
    'insert into public.room_events(room_id,revision) values($1,$2) on conflict(room_id) do update set revision=excluded.revision',
    [room.id, room.revision],
  );
}
export async function createRoom(
  playerId: string,
  name: string,
  mode: Mode,
  botDifficulty: BotDifficulty = 'hard',
  game: GameKind = 'words',
) {
  await transaction((db) => rateLimit(db, `create:${playerId}`, 12, 3600));
  return transaction(async (db) => {
    const now = await databaseTime(db);
    const id = randomUUID();
    let code = '';
    for (let i = 0; i < 10; i++) {
      code = Array.from(
        { length: 6 },
        () => alphabet[randomInt(alphabet.length)],
      ).join('');
      const inserted = await db.query(
        'insert into public.rooms(id,code,mode,expires_at) values($1,$2,$3,$4) on conflict(code) do nothing returning id',
        [id, code, mode, new Date(now + 86400000).toISOString()],
      );
      if (inserted.length) break;
      if (i === 9)
        throw new GameError('Room creation is busy. Please try again.', 503);
    }
    const room: Room = {
      id,
      code,
      mode,
      botDifficulty,
      game,
      revision: 0,
      createdAt: now,
      expiresAt: now + 86400000,
      players: [
        {
          id: playerId,
          name,
          ready: false,
          rematch: false,
          lastSeen: now,
          attempts: [],
        },
      ],
      match: {
        id: randomUUID(),
        round: 1,
        phase: 'lobby',
        answer: pickPuzzle(game),
        startsAt: null,
        deadline: null,
        endedAt: null,
        winnerId: null,
        outcome: null,
      },
    };
    await persist(db, room);
    return projectRoom(room, playerId, now);
  });
}
export async function roomOperation(
  code: string,
  playerId: string,
  action?: Action,
) {
  await transaction((db) => rateLimit(db, `request:${playerId}`, 180, 60));
  const result = await transaction(async (db) => {
    const [row] = await db.query<{ state: Room | string }>(
      `select s.state from private.room_states s join public.rooms r on r.id=s.room_id where r.code=$1 for update of s`,
      [code],
    );
    if (!row)
      throw new GameError(
        'We could not find that room. Check the code or create a new one.',
        404,
      );
    // Older hosted rooms may contain a JSON string instead of a JSON object.
    // The next accepted mutation persists the corrected shape.
    let room: Room =
      typeof row.state === 'string' ? JSON.parse(row.state) : row.state;
    const now = await databaseTime(db); // Read after obtaining lock, never trust client time.
    if (room.expiresAt <= now)
      throw new GameError('This room has expired. Create a fresh room.', 410);
    const participant = room.players.find((p) => p.id === playerId);
    if (participant?.isBot || (!participant && action?.type !== 'join'))
      throw new GameError('Join this room to play.', 403);
    const before = JSON.stringify(room);
    // Give an incoming human the open seat if no bot has claimed it yet.
    if (action?.type !== 'join' || participant) advanceBots(room, now);
    let rejected: GameError | undefined;
    if (action) {
      const candidate = structuredClone(room);
      try {
        applyAction(
          candidate,
          playerId,
          action,
          now,
          puzzleWords(candidate.game),
          () => pickPuzzle(candidate.game, candidate.match.answer),
          randomUUID,
        );
        room = candidate;
      } catch (error) {
        if (!(error instanceof GameError)) throw error;
        rejected = error;
      }
    }
    advanceBots(room, now);
    if (JSON.stringify(room) !== before) await persist(db, room);
    // Commit due bot actions/deadlines even if the human sent an invalid action.
    return rejected
      ? { error: rejected }
      : { view: projectRoom(room, playerId, now) };
  });
  if (result.error) throw result.error;
  return result.view!;
}
