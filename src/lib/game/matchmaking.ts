import type { Room, RoomView } from './types';

/** The ready player chooses when to fill the only open seat. */
export function canPlayWithBot(room: Room | RoomView, playerId: string) {
  return (
    room.match.phase === 'lobby' &&
    room.players.length === 1 &&
    room.players[0].id === playerId &&
    !room.players[0].isBot &&
    room.players[0].ready
  );
}
