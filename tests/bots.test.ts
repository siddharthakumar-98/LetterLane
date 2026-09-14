import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { BOT_WAIT_MS } from '../src/lib/game/matchmaking';
import {
  advanceBots,
  type BotServices,
  BOT_THINK_MIN_MS,
} from '../src/lib/server/bots';
import { chooseBotGuess } from '../src/lib/server/bot-strategy';
import { ALLOWED_WORDS, ANSWERS } from '../src/lib/server/words';
import { applyAction, projectRoom } from '../src/lib/game/rules';
import { actionSchema } from '../src/lib/game/validation';
import { scoreGuess } from '../src/lib/game/scoring';
import type { Attempt, Room } from '../src/lib/game/types';
import { fixture, p1, p2, player } from './fixtures';
const services: BotServices = {
  id: randomUUID,
  randomIndex: () => 0,
  thinkMs: () => BOT_THINK_MIN_MS,
  nextAnswer: () => 'BLOOM',
};
function waiting() {
  const room = fixture();
  room.players = [player()];
  room.match.phase = 'lobby';
  room.match.startsAt = null;
  return room;
}
const human = (room: Room, type: 'ready' | 'rematch', now: number) =>
  applyAction(
    room,
    p1,
    { type },
    now,
    ALLOWED_WORDS,
    () => 'BLOOM',
    randomUUID,
  );
const bot = (room: Room) => room.players.find((p) => p.isBot)!;
function started() {
  const room = waiting();
  human(room, 'ready', 1000);
  advanceBots(room, 46000, services);
  return room;
}

describe('45-second automatic companion', () => {
  it('does not join early; fills precisely one empty seat at the boundary', () => {
    const room = waiting();
    const original = structuredClone(room);
    advanceBots(room, room.createdAt + BOT_WAIT_MS - 1, services);
    expect(room).toEqual(original);
    advanceBots(room, room.createdAt + BOT_WAIT_MS, services);
    expect(room.players).toHaveLength(2);
    expect(bot(room)).toMatchObject({
      name: 'Pip',
      ready: true,
      isBot: true,
      attempts: [],
    });
    expect(room.match.phase).toBe('lobby');
    advanceBots(room, 46001, services);
    expect(room.players).toHaveLength(2);
  });
  it('preserves the human ready choice and the shared three-second countdown', () => {
    const room = started();
    expect(room.match.phase).toBe('countdown');
    expect(room.match.startsAt).toBe(49000);
    expect(room.botNextGuessAt).toBe(57000);
    advanceBots(room, 48999, services);
    expect(bot(room).attempts).toHaveLength(0);
    advanceBots(room, 49000, services);
    expect(room.match.phase).toBe('active');
    expect(bot(room).attempts).toHaveLength(0);
  });
  it('lets an unready creator choose when to begin', () => {
    const room = waiting();
    advanceBots(room, 46000, services);
    expect(room.match.startsAt).toBeNull();
    human(room, 'ready', 50000);
    advanceBots(room, 50000, services);
    expect(room.match.startsAt).toBe(53000);
    expect(room.botNextGuessAt).toBe(61000);
  });
  it('never replaces a human, including a disconnected or unready opponent', () => {
    for (const phase of ['lobby', 'active', 'complete'] as const) {
      const room = fixture();
      room.match.phase = phase;
      room.players[1].lastSeen = 0;
      advanceBots(room, 50000, services);
      expect(room.players.map((p) => p.id)).toEqual([p1, p2]);
      expect(room.players.some((p) => p.isBot)).toBe(false);
    }
  });
  it('does not populate empty, expired or completed rooms', () => {
    const empty = waiting();
    empty.players = [];
    advanceBots(empty, 46000, services);
    expect(empty.players).toHaveLength(0);
    const expired = waiting();
    expired.expiresAt = 46000;
    advanceBots(expired, 46000, services);
    expect(expired.players).toHaveLength(1);
    const ended = waiting();
    ended.match.phase = 'complete';
    advanceBots(ended, 46000, services);
    expect(ended.players).toHaveLength(1);
  });
  it('restores waiting time and pending moves from persisted state', () => {
    const room = JSON.parse(JSON.stringify(waiting())) as Room;
    advanceBots(room, 46000, services);
    human(room, 'ready', 47000);
    advanceBots(room, 47000, services);
    const restored = JSON.parse(JSON.stringify(room)) as Room;
    expect(restored.botNextGuessAt).toBe(58000);
    advanceBots(restored, 58000, services);
    expect(bot(restored).attempts).toHaveLength(1);
  });
});

describe('fair, persisted bot turns', () => {
  it('takes only one move when due and does not act again on repeated polls', () => {
    const room = started();
    advanceBots(room, 56999, services);
    expect(bot(room).attempts).toHaveLength(0);
    advanceBots(room, 57000, services);
    const snapshot = structuredClone(room);
    expect(bot(room).attempts).toHaveLength(1);
    advanceBots(room, 57000, services);
    advanceBots(room, 57001, services);
    expect(room).toEqual(snapshot);
    expect(bot(room).attempts[0].elapsedMs).toBe(8000);
  });
  it('does not burst through missed turns or backdate a move after reconnect', () => {
    const room = started();
    advanceBots(room, 100000, services);
    expect(bot(room).attempts).toHaveLength(1);
    expect(bot(room).attempts[0].elapsedMs).toBe(51000);
    expect(room.botNextGuessAt).toBe(108000);
  });
  it('keeps guesses, answer and scheduling state out of active human snapshots', () => {
    const room = started();
    advanceBots(room, 57000, services);
    const view = projectRoom(room, p1, 57000);
    const opponent = view.players.find((p) => p.isBot)!;
    expect(opponent).toMatchObject({ isBot: true, count: 1 });
    expect(opponent).not.toHaveProperty('attempts');
    expect(view.match).not.toHaveProperty('answer');
    expect(view).not.toHaveProperty('botNextGuessAt');
  });
  it('cannot be created or driven with a client-supplied bot action or flag', () => {
    expect(
      actionSchema.safeParse({ type: 'join', name: 'Pip', isBot: true })
        .success,
    ).toBe(false);
    expect(actionSchema.safeParse({ type: 'bot-guess' }).success).toBe(false);
  });
  it('respects a completed synchronization window instead of stealing a human win', () => {
    const room = started();
    applyAction(
      room,
      p1,
      {
        type: 'guess',
        word: 'CRANE',
        requestId: randomUUID(),
        matchId: room.match.id,
      },
      50000,
      ALLOWED_WORDS,
      () => 'BLOOM',
      randomUUID,
    );
    advanceBots(room, 57000, services);
    expect(room.match.winnerId).toBe(p1);
    expect(bot(room).attempts).toHaveLength(0);
    expect(bot(room).rematch).toBe(true);
  });
  it.each(['duel', 'coop'] as const)(
    'finishes %s using existing rules and stops at six attempts',
    (mode) => {
      const room = started();
      room.mode = mode;
      for (let now = 57000; now <= 120000; now += 8000)
        advanceBots(room, now, services);
      expect(room.match.phase).toBe('complete');
      expect(room.match.outcome).toBe(mode === 'coop' ? 'team-win' : 'solved');
      expect(bot(room).attempts.length).toBeLessThanOrEqual(6);
      const count = bot(room).attempts.length;
      advanceBots(room, 200000, services);
      expect(bot(room).attempts).toHaveLength(count);
      expect(bot(room).rematch).toBe(true);
    },
  );
  it('automatically votes for a rematch while preserving the human choice and bot identity', () => {
    const room = started();
    room.match.phase = 'complete';
    const id = bot(room).id;
    advanceBots(room, 60000, services);
    expect(bot(room).rematch).toBe(true);
    expect(room.match.round).toBe(1);
    human(room, 'rematch', 61000);
    advanceBots(room, 61000, services);
    expect(room.match).toMatchObject({
      round: 2,
      phase: 'countdown',
      answer: 'BLOOM',
      startsAt: 64000,
    });
    expect(bot(room).id).toBe(id);
    expect(bot(room).attempts).toHaveLength(0);
    expect(room.botNextGuessAt).toBe(72000);
  });
});

describe('bot strategy has only its own feedback', () => {
  it('filters duplicate letters with the same scoring rules as players', () => {
    const history = [{ word: 'ALLEY', marks: scoreGuess('APPLE', 'ALLEY') }];
    const vocabulary = ['APPLE', 'AMPLE', 'MAPLE', 'APPLY', 'JELLY', 'ALLEY'];
    const word = chooseBotGuess(history, vocabulary, () => 0);
    expect(scoreGuess(word, 'ALLEY')).toEqual(history[0].marks);
    expect(word).not.toBe('ALLEY');
  });
  it('only makes unique allowed guesses and uses no opponent or answer input', () => {
    for (const answer of ['CRANE', 'APPLE', 'LEVEL', 'BLOOM', 'SHEEP']) {
      const history: Attempt[] = [];
      for (let i = 0; i < 6; i++) {
        const word = chooseBotGuess(history, ANSWERS, () => 0);
        expect(ALLOWED_WORDS.has(word)).toBe(true);
        expect(history.some((a) => a.word === word)).toBe(false);
        const marks = scoreGuess(answer, word);
        history.push({
          word,
          marks,
          elapsedMs: i * 8000,
          requestId: randomUUID(),
        });
        if (marks.every((m) => m === 'correct')) break;
      }
      expect(history.at(-1)!.word).toBe(answer);
    }
  });
});

it('a bot with an expired clock cannot take a due turn or block the human from finishing', () => {
  const room = started();
  applyAction(
    room,
    p1,
    {
      type: 'guess',
      word: 'SLATE',
      requestId: randomUUID(),
      matchId: room.match.id,
    },
    50000,
    ALLOWED_WORDS,
    () => 'BLOOM',
    randomUUID,
  );
  // Bot has no bonuses, human earned 40s. Simulate reopening after a long disconnect.
  const expiredAt = room.match.startsAt! + 90000;
  advanceBots(room, expiredAt, services);
  expect(bot(room).attempts).toHaveLength(0);
  expect(room.botNextGuessAt).toBeNull();
  expect(room.match.phase).toBe('active');
  applyAction(
    room,
    p1,
    {
      type: 'guess',
      word: 'CRANE',
      requestId: randomUUID(),
      matchId: room.match.id,
    },
    expiredAt + 1,
    ALLOWED_WORDS,
    () => 'BLOOM',
    randomUUID,
  );
  advanceBots(room, expiredAt + 1, services);
  expect(room.match.winnerId).toBe(p1);
  expect(bot(room).rematch).toBe(true);
});
