import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  advance,
  applyAction,
  projectRoom,
  winner,
  failureRank,
} from '../src/lib/game/rules';
import { scoreGuess } from '../src/lib/game/scoring';
import type { Action, Room, Attempt } from '../src/lib/game/types';
import { fixture, p1, p2, p3, allowed } from './fixtures';
const act = (r: Room, id: string, a: Action, now = 1100) =>
  applyAction(r, id, a, now, allowed, () => 'BLOOM', randomUUID);
const guess = (r: Room, word: string): Action => ({
  type: 'guess',
  word,
  requestId: randomUUID(),
  matchId: r.match.id,
});
const attempt = (word: string, answer = 'CRANE', elapsedMs = 100): Attempt => ({
  word,
  marks: scoreGuess(answer, word),
  elapsedMs,
  requestId: randomUUID(),
});
describe('room and state invariants', () => {
  it('rejects a third player but allows the original identity to rejoin', () => {
    const r = fixture();
    expect(() => act(r, p3, { type: 'join', name: 'Third' })).toThrow(
      'two players',
    );
    expect(act(r, p1, { type: 'join', name: 'Ada' }).players).toHaveLength(2);
  });
  it('starts only after both are ready and rejects early guesses', () => {
    const r = fixture();
    r.match.phase = 'lobby';
    act(r, p1, { type: 'ready' });
    expect(r.match.phase).toBe('lobby');
    act(r, p2, { type: 'ready' });
    expect(r.match.startsAt).toBe(4100);
    expect(() => act(r, p1, guess(r, 'SLATE'), 4099)).toThrow('countdown');
    act(r, p1, guess(r, 'SLATE'), 4100);
    expect(r.players[0].attempts).toHaveLength(1);
  });
  it('does not consume invalid words or duplicate words', () => {
    const r = fixture();
    expect(() => act(r, p1, guess(r, 'ZZZZZ'))).toThrow('dictionary');
    expect(r.players[0].attempts).toHaveLength(0);
    act(r, p1, guess(r, 'SLATE'));
    expect(() => act(r, p1, guess(r, 'SLATE'))).toThrow('already tried');
    expect(r.players[0].attempts).toHaveLength(1);
  });
  it('retries a submission idempotently and rejects reusing its id with new content', () => {
    const r = fixture();
    const a = guess(r, 'SLATE');
    act(r, p1, a);
    act(r, p1, a);
    expect(r.players[0].attempts).toHaveLength(1);
    expect(() => act(r, p1, { ...a, word: 'APPLE' } as Action)).toThrow(
      'already used',
    );
  });
  it('caps attempts at six, prevents pre-finish rematches and post-finish guesses', () => {
    const r = fixture();
    for (const w of ['SLATE', 'APPLE', 'BLOOM', 'JELLY', 'MIGHT', 'FOUND'])
      act(r, p1, guess(r, w));
    expect(() => act(r, p1, guess(r, 'CHIME'))).toThrow('finished');
    expect(() => act(r, p2, { type: 'rematch' })).toThrow('Finish');
    r.match.phase = 'complete';
    expect(() => act(r, p2, guess(r, 'CRANE'))).toThrow('ended');
  });
  it('rejects expired rooms and outsiders', () => {
    const r = fixture();
    expect(() => act(r, p3, { type: 'ready' })).toThrow('Join');
    expect(() => act(r, p1, { type: 'heartbeat' }, 999999)).toThrow('expired');
  });
  it('reconnects with accepted guesses intact', () => {
    const r = fixture();
    act(r, p1, guess(r, 'SLATE'));
    act(r, p1, { type: 'join', name: 'New name' }, 4000);
    expect(r.players[0].name).toBe('Ada');
    expect(r.players[0].lastSeen).toBe(4000);
    expect(projectRoom(r, p1, 4000).players[0].attempts).toHaveLength(1);
  });
  it('projects only the current player’s guesses, never an active answer', () => {
    const r = fixture();
    act(r, p2, guess(r, 'APPLE'));
    const view = projectRoom(r, p1, 1200);
    expect(view.match).not.toHaveProperty('answer');
    expect(view.players[1]).not.toHaveProperty('attempts');
    expect(JSON.stringify(view)).not.toContain('APPLE');
    expect(view.players[1].count).toBe(1);
    expect(() => projectRoom(r, p3, 1200)).toThrow('Join');
    r.match.phase = 'complete';
    expect(projectRoom(r, p1, 1300).match.answer).toBe('CRANE');
    expect(projectRoom(r, p1, 1300).players[1].attempts?.[0].word).toBe(
      'APPLE',
    );
  });
  it('requires both rematch votes and rejects a stale round submission', () => {
    const r = fixture();
    r.match.phase = 'complete';
    const old = guess(r, 'SLATE');
    act(r, p1, { type: 'rematch' });
    expect(r.match.phase).toBe('complete');
    act(r, p2, { type: 'rematch' });
    expect(r.match.round).toBe(2);
    expect(r.match.answer).toBe('BLOOM');
    expect(r.match.phase).toBe('countdown');
    expect(r.players.every((p) => p.attempts.length === 0)).toBe(true);
    expect(() => act(r, p1, old, 5000)).toThrow('previous round');
  });
});
describe('winner rules and simultaneous finishes', () => {
  it('settles first solve after the synchronization window', () => {
    const r = fixture();
    act(r, p1, guess(r, 'CRANE'), 1500);
    expect(r.match.phase).toBe('active');
    advance(r, 2249);
    expect(r.match.phase).toBe('active');
    advance(r, 2250);
    expect(r.match.winnerId).toBe(p1);
    expect(() => act(r, p2, guess(r, 'CRANE'), 2251)).toThrow('ended');
  });
  it('a later solve inside the window wins with fewer guesses', () => {
    const r = fixture();
    act(r, p1, guess(r, 'SLATE'), 1200);
    act(r, p1, guess(r, 'CRANE'), 1500);
    act(r, p2, guess(r, 'CRANE'), 1900);
    expect(r.match.winnerId).toBe(p2);
    expect(r.match.phase).toBe('complete');
  });
  it('breaks equal guess count by server elapsed time', () => {
    const r = fixture();
    act(r, p1, guess(r, 'CRANE'), 1500);
    act(r, p2, guess(r, 'CRANE'), 1600);
    expect(r.match.winnerId).toBe(p1);
  });
  it('draws exactly equal finishing times', () => {
    const r = fixture();
    act(r, p1, guess(r, 'CRANE'), 1500);
    act(r, p2, guess(r, 'CRANE'), 1500);
    expect(r.match.outcome).toBe('draw');
  });
  it('compares best revealed count before attempt efficiency', () => {
    const r = fixture();
    r.players[0].attempts = [attempt('JELLY'), attempt('CRANE', 'CRAZY')];
    r.players[1].attempts = [attempt('SLATE')];
    expect(winner(r.players).winnerId).toBe(p1);
  });
  it('compares the earliest attempt that reaches the same high score', () => {
    const r = fixture();
    r.players[0].attempts = [attempt('JELLY'), attempt('SLATE')];
    r.players[1].attempts = [attempt('SLATE')];
    expect(winner(r.players).winnerId).toBe(p2);
    expect(failureRank(r.players[0].attempts)).toEqual([2, -2, 2, 0]);
  });
  it('then favors exact positions and draws identical scores', () => {
    const r = fixture();
    r.players[0].attempts = [
      {
        ...attempt('SLATE'),
        marks: ['correct', 'correct', 'absent', 'absent', 'absent'],
      },
    ];
    r.players[1].attempts = [
      {
        ...attempt('SLATE'),
        marks: ['present', 'present', 'absent', 'absent', 'absent'],
      },
    ];
    expect(winner(r.players).winnerId).toBe(p1);
    r.players[1].attempts = r.players[0].attempts;
    expect(winner(r.players).outcome).toBe('draw');
  });
  it('finishes after both players exhaust six guesses', () => {
    const r = fixture();
    for (const id of [p1, p2])
      for (const w of ['SLATE', 'APPLE', 'BLOOM', 'JELLY', 'MIGHT', 'FOUND'])
        act(r, id, guess(r, w));
    expect(r.match.phase).toBe('complete');
    expect(r.match.outcome).toBe('draw');
  });
  it('co-op wins immediately when either player solves', () => {
    const r = fixture();
    r.mode = 'coop';
    act(r, p2, guess(r, 'CRANE'));
    expect(r.match.phase).toBe('complete');
    expect(r.match.outcome).toBe('team-win');
    expect(r.match.winnerId).toBeNull();
  });
  it('co-op loses only when all twelve attempts are used', () => {
    const r = fixture();
    r.mode = 'coop';
    for (const id of [p1, p2])
      for (const w of ['SLATE', 'APPLE', 'BLOOM', 'JELLY', 'MIGHT', 'FOUND'])
        act(r, id, guess(r, w));
    expect(r.match.outcome).toBe('team-loss');
  });
});
