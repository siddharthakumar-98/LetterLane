import 'server-only';
import { randomInt, randomUUID } from 'node:crypto';
import { transaction, databaseTime } from './db';
import { puzzleWords, pickPuzzle } from './puzzles';
import { applyAction, projectRoom } from '../game/rules';
import {
  GameError,
  type Action,
  type Mode,
  type Room,
  type BotDifficulty,
  type GameKind,
  type WordLength,
  type PhraseDifficulty,
} from '../game/types';
import { advanceBots } from './bots';
import { rateLimit } from './rate-limit';
import { persistRoom } from './room-persistence';
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export async function createRoom(
  playerId: string,
  name: string,
  mode: Mode,
  botDifficulty: BotDifficulty = 'hard',
  game: GameKind = 'words',
  wordLength: WordLength = 5,
  phraseDifficulty: PhraseDifficulty = 'normal',
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
      ...(game === 'words' ? { wordLength } : {}),
      ...(game === 'phrases' ? { phraseDifficulty } : {}),
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
        answer: pickPuzzle(game, undefined, wordLength, phraseDifficulty),
        startsAt: null,
        deadline: null,
        endedAt: null,
        winnerId: null,
        outcome: null,
      },
    };
    await persistRoom(db, room);
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
    advanceBots(room, now);
    let rejected: GameError | undefined;
    if (action) {
      const candidate = structuredClone(room);
      try {
        applyAction(
          candidate,
          playerId,
          action,
          now,
          puzzleWords(candidate.game, candidate.wordLength),
          () =>
            pickPuzzle(
              candidate.game,
              candidate.match.answer,
              candidate.wordLength,
              candidate.phraseDifficulty,
            ),
          randomUUID,
        );
        room = candidate;
      } catch (error) {
        if (!(error instanceof GameError)) throw error;
        rejected = error;
      }
    }
    advanceBots(room, now);
    if (JSON.stringify(room) !== before)
      await persistRoom(
        db,
        room,
        // Legacy string snapshots receive a full projection repair.
        typeof row.state === 'string' ? undefined : JSON.parse(before),
      );
    // Commit due bot actions/deadlines even if the human sent an invalid action.
    return rejected
      ? { error: rejected }
      : { view: projectRoom(room, playerId, now) };
  });
  if (result.error) throw result.error;
  return result.view!;
}
