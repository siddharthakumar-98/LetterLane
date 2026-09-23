export type Mark = 'correct' | 'present' | 'elsewhere' | 'absent';
export type GameKind = 'words' | 'phrases';
export type Mode = 'duel' | 'coop';
export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type Attempt = {
  word: string;
  marks: Mark[];
  elapsedMs: number;
  requestId: string;
};
export type Player = {
  /** Absent in pre-v1.1 saved rooms; absence means a human. */
  isBot?: boolean;
  id: string;
  name: string;
  ready: boolean;
  rematch: boolean;
  lastSeen: number;
  attempts: Attempt[];
};
export type Room = {
  /** Older rooms remain Words. */
  game?: GameKind;
  /** Missing in older rooms, which retain the original hard bot. */
  botDifficulty?: BotDifficulty;
  /** Private scheduling state: never projected to clients. */
  botNextGuessAt?: number | null;
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
  timedOut: boolean;
  /** Both clocks are public; words and per-letter marks remain private. */
  timerEndsAt?: number | null;
  timerStoppedAt?: number | null;
  attempts?: Attempt[];
};
export type RoomView = Omit<Room, 'players' | 'match' | 'botNextGuessAt'> & {
  selfId: string;
  players: PlayerView[];
  serverTime: number;
  match: Omit<Room['match'], 'answer'> & {
    answer?: string;
    phraseTemplate?: string;
  };
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
