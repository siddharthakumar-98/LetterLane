import 'server-only';
import { randomInt, randomUUID } from 'node:crypto';
import { BOT_WAIT_MS } from '../game/matchmaking';
import {
  advance,
  applyAction,
  MAX_ATTEMPTS,
  solved,
  outOfTime,
} from '../game/rules';
import type { Action, Room, BotDifficulty, GameKind } from '../game/types';
import { BOT_PROFILES } from '../game/bot-difficulty';
import { ANSWERS } from './words';
import { puzzleWords, pickPuzzle } from './puzzles';
import { phraseTemplate } from '../game/phrases';
import { choosePhraseBotGuess } from './phrase-bot';
import { chooseBotGuess } from './bot-strategy';

export const BOT_THINK_MIN_MS = BOT_PROFILES.hard.thinkMinMs;
export const BOT_THINK_MAX_MS = BOT_PROFILES.hard.thinkMaxMs;
export type BotServices = {
  id: () => string;
  randomIndex: (length: number) => number;
  thinkMs: (difficulty: BotDifficulty) => number;
  nextAnswer: (previous: string, game?: GameKind) => string;
};
const production: BotServices = {
  id: randomUUID,
  randomIndex: randomInt,
  thinkMs: (difficulty) => {
    const profile = BOT_PROFILES[difficulty];
    return randomInt(profile.thinkMinMs, profile.thinkMaxMs + 1);
  },
  nextAnswer: (previous, game) => pickPuzzle(game, previous),
};

/** Call only under the room's DB row lock. No timers or jobs survive a request. */
export function advanceBots(room: Room, now: number, services = production) {
  if (now >= room.expiresAt) return;
  const difficulty = room.botDifficulty ?? 'hard';
  advance(room, now);
  const act = (id: string, action: Action) =>
    applyAction(
      room,
      id,
      action,
      now,
      puzzleWords(room.game),
      () => services.nextAnswer(room.match.answer, room.game),
      services.id,
    );
  if (
    room.match.phase === 'lobby' &&
    room.players.length === 1 &&
    !room.players[0].isBot &&
    now >= room.createdAt + BOT_WAIT_MS
  ) {
    const id = services.id();
    act(id, { type: 'join', name: BOT_PROFILES[difficulty].name });
    room.players.find((player) => player.id === id)!.isBot = true;
    act(id, { type: 'ready' });
  }
  const bot = room.players.find((player) => player.isBot);
  if (!bot) return;
  const readyForRematch = () => {
    if (room.match.phase === 'complete') {
      room.botNextGuessAt = null;
      if (!bot.rematch) act(bot.id, { type: 'rematch' });
    }
  };
  readyForRematch();
  if (room.match.phase !== 'countdown' && room.match.phase !== 'active') return;
  if (
    solved(bot) ||
    bot.attempts.length >= MAX_ATTEMPTS ||
    outOfTime(room, bot, now)
  ) {
    room.botNextGuessAt = null;
    return;
  }
  if (room.botNextGuessAt == null) {
    room.botNextGuessAt =
      Math.max(now, room.match.startsAt!) + services.thinkMs(difficulty);
  }
  if (room.match.phase !== 'active' || now < room.botNextGuessAt) return;
  const word =
    room.game === 'phrases'
      ? choosePhraseBotGuess(
          phraseTemplate(room.match.answer),
          bot.attempts,
          services.randomIndex,
          difficulty,
        )
      : chooseBotGuess(bot.attempts, ANSWERS, services.randomIndex, difficulty);
  act(bot.id, {
    type: 'guess',
    word,
    requestId: services.id(),
    matchId: room.match.id,
  });
  // No catch-up burst or backdated times after a disconnect or sleeping tab.
  room.botNextGuessAt = now + services.thinkMs(difficulty);
  readyForRematch();
}
