export type Mark = 'correct' | 'present' | 'absent';
export type Mode = 'duel' | 'coop';
export type Attempt = {
  word: string;
  marks: Mark[];
  elapsedMs: number;
  requestId: string;
};
export type Player = {
  id: string;
  name: string;
  ready: boolean;
  rematch: boolean;
  lastSeen: number;
  attempts: Attempt[];
};
export type Room = {
  id: string;
  code: string;
  mode: Mode;
  revision: number;
  createdAt: number;
  expiresAt: number;
  players: Player[];
  match: {
    id: string;
    round: number;
    phase: 'lobby' | 'countdown' | 'active' | 'complete';
    answer: string;
    startsAt: number | null;
    deadline: number | null;
    endedAt: number | null;
    winnerId: string | null;
    outcome: 'solved' | 'points' | 'draw' | 'team-win' | 'team-loss' | null;
  };
};
export type PlayerView = Omit<Player, 'attempts'> & {
  count: number;
  solved: boolean;
  attempts?: Attempt[];
};
export type RoomView = Omit<Room, 'players' | 'match'> & {
  selfId: string;
  players: PlayerView[];
  serverTime: number;
  match: Omit<Room['match'], 'answer'> & { answer?: string };
};
export type Action =
  | { type: 'join'; name: string }
  | { type: 'ready' }
  | { type: 'rematch' }
  | { type: 'heartbeat' }
  | { type: 'guess'; word: string; requestId: string; matchId: string };
export class GameError extends Error {
  constructor(
    message: string,
    public status = 409,
  ) {
    super(message);
  }
}
