import type { RoomView } from '../game/types';

function reuseEqual<T>(previous: T, next: T): T {
  return JSON.stringify(previous) === JSON.stringify(next) ? previous : next;
}

/** Polls carry fresh time/presence but usually unchanged, immutable game history. */
export function reconcileRoom(
  previous: RoomView | null,
  next: RoomView,
): RoomView {
  if (!previous || previous.id !== next.id || previous.selfId !== next.selfId)
    return next;
  if (
    next.revision < previous.revision ||
    (next.revision === previous.revision &&
      next.serverTime < previous.serverTime)
  )
    return previous;
  return {
    ...next,
    match: reuseEqual(previous.match, next.match),
    players: next.players.map((player) => {
      const old = previous.players.find(({ id }) => id === player.id);
      if (!old) return player;
      return {
        ...player,
        // Preserve absent opponent history; revealing results must never reuse
        // another player's private attempts, even across identity changes.
        ...(player.attempts
          ? { attempts: reuseEqual(old.attempts, player.attempts) }
          : {}),
        guessMarks: reuseEqual(old.guessMarks, player.guessMarks),
      };
    }),
  };
}
