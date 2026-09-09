import { randomUUID } from 'node:crypto';
import type { Player, Room } from '../src/lib/game/types';
export const p1 = '11111111-1111-4111-8111-111111111111';
export const p2 = '22222222-2222-4222-8222-222222222222';
export const p3 = '33333333-3333-4333-8333-333333333333';
export const allowed = new Set([
  'CRANE',
  'BLOOM',
  'SLATE',
  'APPLE',
  'ALLEY',
  'CHIME',
  'CHARM',
  'BRAVE',
  'SHARK',
  'MIGHT',
  'FOUND',
  'JELLY',
]);
export function player(id = p1): Player {
  return {
    id,
    name: id === p1 ? 'Ada' : 'Max',
    ready: false,
    rematch: false,
    lastSeen: 1000,
    attempts: [],
  };
}
export function fixture(): Room {
  return {
    id: randomUUID(),
    code: 'ABCDEF',
    mode: 'duel',
    revision: 0,
    createdAt: 1000,
    expiresAt: 999999,
    players: [player(), player(p2)],
    match: {
      id: randomUUID(),
      round: 1,
      phase: 'active',
      answer: 'CRANE',
      startsAt: 1000,
      deadline: null,
      endedAt: null,
      winnerId: null,
      outcome: null,
    },
  };
}
