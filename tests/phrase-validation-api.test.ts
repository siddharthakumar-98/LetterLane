import { beforeEach, expect, it, vi } from 'vitest';
import type { DB } from '../src/lib/server/db';
import { GameError } from '../src/lib/game/types';

const mocks = vi.hoisted(() => ({ query: vi.fn(), identity: vi.fn() }));
vi.mock('../src/lib/server/auth', () => ({ getPlayerId: mocks.identity }));
vi.mock('../src/lib/server/db', () => ({
  transaction: (callback: (db: DB) => unknown) =>
    callback({ query: mocks.query }),
}));
import { POST } from '../src/app/api/phrases/validate/route';

beforeEach(() => {
  mocks.query.mockReset().mockResolvedValue([{ hits: 1 }]);
  mocks.identity.mockReset().mockResolvedValue('guest-player');
});
const request = (body: unknown, origin = 'http://localhost:3000') =>
  new Request('http://localhost:3000/api/phrases/validate', {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

it('returns only independent validity booleans and never queries a room or answer', async () => {
  const response = await POST(
    request({ words: ['LUNG', 'NIFFS', "CAN'T", 'WELL-KNOWN', 'JS', 'ROAD'] }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    valid: [true, false, true, true, false, true],
  });
  expect(response.headers.get('Cache-Control')).toContain('no-store');
  expect(mocks.query).toHaveBeenCalledTimes(1);
  expect(mocks.query.mock.calls[0][0]).toContain('private.rate_limits');
  expect(mocks.query.mock.calls[0][1]).toEqual([
    'phrase-validation:guest-player',
    60,
  ]);
});
it.each([
  { words: [] },
  { words: Array(8).fill('ROAD') },
  { words: ['X'.repeat(65)] },
  { words: [23] },
  { words: ['ROAD'], room: 'ABCDEF' },
  { words: ['ROAD'], answer: 'SECRET' },
])('rejects malformed or excessive validation requests: %j', async (body) => {
  expect((await POST(request(body))).status).toBe(422);
  expect(mocks.query).not.toHaveBeenCalled();
});
it('does not normalize malformed tokens into allowed words', async () => {
  const response = await POST(
    request({ words: ['RO4D', 'R O A D', 'ROAD--ROOM'] }),
  );
  expect(await response.json()).toEqual({ valid: [false, false, false] });
});
it('enforces authentication, origin and the existing request size limit', async () => {
  expect(
    (await POST(request({ words: ['ROAD'] }, 'https://elsewhere.test'))).status,
  ).toBe(403);
  expect((await POST(request({ words: ['X'.repeat(2100)] }))).status).toBe(413);
  mocks.identity.mockRejectedValue(
    new GameError('Guest session required.', 401),
  );
  expect((await POST(request({ words: ['ROAD'] }))).status).toBe(401);
  expect(mocks.query).not.toHaveBeenCalled();
});
it('applies a separate 60-request-per-minute player limit', async () => {
  mocks.query
    .mockResolvedValueOnce([{ hits: 60 }])
    .mockResolvedValueOnce([{ hits: 61 }]);
  expect((await POST(request({ words: ['ROAD'] }))).status).toBe(200);
  expect((await POST(request({ words: ['ROAD'] }))).status).toBe(429);
});
