import { scoreGuess } from './scoring';
import { validateGuess } from './validation';
import {
  GameError,
  type Action,
  type Attempt,
  type Player,
  type Room,
  type RoomView,
} from './types';
export const SYNC_WINDOW_MS = 750;
export const COUNTDOWN_MS = 3000;
export const MAX_ATTEMPTS = 6;
export const solved = (p: Pick<Player, 'attempts'>) =>
  p.attempts.some((a) => a.marks.every((m) => m === 'correct'));
function compare(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
/** Highest revealed total, earliest attempt reaching it, then exact and misplaced counts. */
export function failureRank(attempts: Attempt[]): number[] {
  return attempts.reduce(
    (best, a, i) => {
      const exact = a.marks.filter((m) => m === 'correct').length;
      const misplaced = a.marks.filter((m) => m === 'present').length;
      const rank = [exact + misplaced, -(i + 1), exact, misplaced];
      return compare(rank, best) > 0 ? rank : best;
    },
    [0, -7, 0, 0],
  );
}
export function winner(players: Player[]): {
  winnerId: string | null;
  outcome: 'solved' | 'points' | 'draw';
} {
  const winners = players.filter(solved);
  if (winners.length === 1)
    return { winnerId: winners[0].id, outcome: 'solved' };
  if (winners.length === 2) {
    const [a, b] = winners;
    const delta = compare(
      [-a.attempts.length, -a.attempts.at(-1)!.elapsedMs],
      [-b.attempts.length, -b.attempts.at(-1)!.elapsedMs],
    );
    return {
      winnerId: delta === 0 ? null : delta > 0 ? a.id : b.id,
      outcome: delta === 0 ? 'draw' : 'solved',
    };
  }
  const delta = compare(
    failureRank(players[0].attempts),
    failureRank(players[1].attempts),
  );
  return {
    winnerId: delta === 0 ? null : delta > 0 ? players[0].id : players[1].id,
    outcome: delta === 0 ? 'draw' : 'points',
  };
}
function finish(room: Room, now: number) {
  room.match.phase = 'complete';
  room.match.endedAt = now;
  if (room.mode === 'coop') {
    room.match.outcome = room.players.some(solved) ? 'team-win' : 'team-loss';
    room.match.winnerId = null;
  } else Object.assign(room.match, winner(room.players));
}
export function advance(room: Room, now: number) {
  if (room.match.phase === 'countdown' && now >= room.match.startsAt!)
    room.match.phase = 'active';
  if (
    room.match.phase === 'active' &&
    room.match.deadline !== null &&
    now >= room.match.deadline
  )
    finish(room, now);
}
export function applyAction(
  room: Room,
  playerId: string,
  action: Action,
  now: number,
  allowed: ReadonlySet<string>,
  nextAnswer: () => string,
  nextId: () => string,
): Room {
  if (now >= room.expiresAt)
    throw new GameError('This room has expired. Create a fresh room.', 410);
  advance(room, now);
  let player = room.players.find((p) => p.id === playerId);
  if (action.type === 'join') {
    if (player) {
      player.lastSeen = now;
      return room;
    }
    if (room.players.length >= 2)
      throw new GameError('This room already has two players.', 409);
    if (room.match.phase !== 'lobby')
      throw new GameError('This match has already started.');
    player = {
      id: playerId,
      name: action.name,
      ready: false,
      rematch: false,
      lastSeen: now,
      attempts: [],
    };
    room.players.push(player);
    return room;
  }
  if (!player) throw new GameError('Join this room to play.', 403);
  player.lastSeen = now;
  if (action.type === 'heartbeat') return room;
  if (action.type === 'ready') {
    if (room.match.phase !== 'lobby')
      throw new GameError('The match has already started.');
    player.ready = true;
    if (room.players.length === 2 && room.players.every((p) => p.ready)) {
      room.match.phase = 'countdown';
      room.match.startsAt = now + COUNTDOWN_MS;
    }
  }
  if (action.type === 'guess') {
    if (action.matchId !== room.match.id)
      throw new GameError('That guess belongs to the previous round.');
    const existing = player.attempts.find(
      (a) => a.requestId === action.requestId,
    );
    if (existing) {
      if (existing.word !== action.word.trim().toUpperCase())
        throw new GameError('That submission was already used.');
      return room;
    }
    if (room.match.phase !== 'active')
      throw new GameError(
        room.match.phase === 'complete'
          ? 'This round has ended.'
          : 'Wait for the countdown to finish.',
      );
    if (solved(player) || player.attempts.length >= MAX_ATTEMPTS)
      throw new GameError('You have finished this round.');
    const word = validateGuess(action.word, allowed);
    if (player.attempts.some((a) => a.word === word))
      throw new GameError('You have already tried that word.', 422);
    player.attempts.push({
      word,
      marks: scoreGuess(room.match.answer, word),
      elapsedMs: now - room.match.startsAt!,
      requestId: action.requestId,
    });
    if (solved(player) && room.match.deadline === null)
      room.match.deadline = now + SYNC_WINDOW_MS;
    if (
      (room.mode === 'coop' && solved(player)) ||
      room.players.every((p) => solved(p) || p.attempts.length >= MAX_ATTEMPTS)
    )
      finish(room, now);
  }
  if (action.type === 'rematch') {
    if (room.match.phase !== 'complete')
      throw new GameError('Finish this round before starting another.');
    player.rematch = true;
    if (room.players.length === 2 && room.players.every((p) => p.rematch)) {
      const answer = nextAnswer();
      room.match = {
        id: nextId(),
        round: room.match.round + 1,
        phase: 'countdown',
        answer,
        startsAt: now + COUNTDOWN_MS,
        deadline: null,
        endedAt: null,
        winnerId: null,
        outcome: null,
      };
      room.players.forEach((p) => {
        p.attempts = [];
        p.rematch = false;
        p.ready = true;
      });
      room.expiresAt = now + 24 * 60 * 60 * 1000;
    }
  }
  return room;
}
export function projectRoom(
  room: Room,
  playerId: string,
  now: number,
): RoomView {
  if (!room.players.some((p) => p.id === playerId))
    throw new GameError('Join this room to play.', 403);
  const { answer, ...match } = room.match;
  return {
    id: room.id,
    code: room.code,
    mode: room.mode,
    revision: room.revision,
    createdAt: room.createdAt,
    expiresAt: room.expiresAt,
    selfId: playerId,
    serverTime: now,
    match: { ...match, ...(match.phase === 'complete' ? { answer } : {}) },
    players: room.players.map(({ attempts, ...p }) => ({
      ...p,
      count: attempts.length,
      solved: solved({ attempts }),
      ...(p.id === playerId || match.phase === 'complete' ? { attempts } : {}),
    })),
  };
}
