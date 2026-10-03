import 'server-only';
import type { DB } from './db';
import type { Room } from '../game/types';

/** Persist changed projections under the room lock, then publish the revision. */
export async function persistRoom(db: DB, room: Room, previous?: Room) {
  room.revision++;
  if (!previous || previous.expiresAt !== room.expiresAt)
    await db.query('update public.rooms set expires_at=$2 where id=$1', [
      room.id,
      new Date(room.expiresAt).toISOString(),
    ]);
  for (const [seat, p] of room.players.entries()) {
    const old = previous?.players.find((player) => player.id === p.id);
    if (!old || old.name !== p.name || old.isBot !== p.isBot)
      await db.query(
        'insert into public.players(id,display_name,is_bot) values($1,$2,$3) on conflict(id) do update set display_name=excluded.display_name,is_bot=excluded.is_bot',
        [p.id, p.name, p.isBot ?? false],
      );
    if (!old || old.ready !== p.ready || old.lastSeen !== p.lastSeen)
      await db.query(
        `insert into public.room_participants(room_id,player_id,seat,ready,last_seen) values($1,$2,$3,$4,$5)
      on conflict(room_id,player_id) do update set ready=excluded.ready,last_seen=excluded.last_seen`,
        [room.id, p.id, seat, p.ready, new Date(p.lastSeen).toISOString()],
      );
  }
  const m = room.match;
  const sameMatch = previous?.match.id === m.id;
  if (
    !sameMatch ||
    previous.match.phase !== m.phase ||
    previous.match.startsAt !== m.startsAt ||
    previous.match.endedAt !== m.endedAt ||
    previous.match.winnerId !== m.winnerId ||
    previous.match.outcome !== m.outcome
  )
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
    const old = sameMatch
      ? previous.players.find((player) => player.id === p.id)
      : undefined;
    // Accepted attempts are append-only within a match.
    for (let i = old?.attempts.length ?? 0; i < p.attempts.length; i++) {
      const a = p.attempts[i];
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
    }
    if (!old || old.rematch !== p.rematch)
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
