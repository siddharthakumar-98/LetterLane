import { expect, it } from 'vitest';
import { checkOrigin, readBody, failure } from '../src/lib/server/http';
it('rejects cross-origin and missing-origin mutations', () => {
  expect(() =>
    checkOrigin(
      new Request('http://localhost:3000', {
        headers: { host: 'localhost:3000', origin: 'https://evil.example' },
      }),
    ),
  ).toThrow('verified');
  expect(() =>
    checkOrigin(
      new Request('http://localhost:3000', {
        headers: { host: 'localhost:3000' },
      }),
    ),
  ).toThrow('verified');
  expect(() =>
    checkOrigin(
      new Request('http://localhost:3000', {
        headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
      }),
    ),
  ).not.toThrow();
});
it('limits streamed JSON input and rejects malformed data', async () => {
  await expect(
    readBody(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'x'.repeat(2100),
      }),
    ),
  ).rejects.toThrow('too large');
  await expect(
    readBody(
      new Request('http://localhost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{bad',
      }),
    ),
  ).rejects.toThrow('valid game action');
});
it('never includes raw database errors or secrets in API errors', async () => {
  const response = failure(new Error('CRANE database password secret'));
  expect(await response.text()).not.toMatch(/CRANE|password|secret/);
  expect(response.status).toBe(503);
  expect(response.headers.get('Cache-Control')).toContain('no-store');
});

it('validates bot difficulty on room creation and preserves older clients', async () => {
  const { createSchema, actionSchema } =
    await import('../src/lib/game/validation');
  const base = { name: 'Ada', mode: 'duel' };
  expect(createSchema.parse(base).botDifficulty).toBe('hard');
  for (const botDifficulty of ['easy', 'medium', 'hard']) {
    expect(createSchema.parse({ ...base, botDifficulty }).botDifficulty).toBe(
      botDifficulty,
    );
  }
  for (const botDifficulty of ['expert', null, 0, { name: 'Pip' }]) {
    expect(createSchema.safeParse({ ...base, botDifficulty }).success).toBe(
      false,
    );
  }
  expect(
    actionSchema.safeParse({ type: 'join', name: 'Max', botDifficulty: 'easy' })
      .success,
  ).toBe(false);
});
