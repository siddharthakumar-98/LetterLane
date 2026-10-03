import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const createClient = vi.hoisted(() => vi.fn());
vi.mock('@supabase/supabase-js', () => ({ createClient }));
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.resetModules();
  createClient.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
const json = (body: unknown, status = 200) => Response.json(body, { status });

it('shares concurrent local initialization and never creates a Supabase client', async () => {
  fetchMock.mockImplementation(async (url, options) => {
    if (url === '/api/session')
      return json(options?.method === 'POST' ? {} : { backend: 'local' });
    return json({ ok: true });
  });
  const { api } = await import('../src/lib/client/api');
  expect(await Promise.all([api('/one'), api('/two')])).toEqual([
    { ok: true },
    { ok: true },
  ]);
  expect(
    fetchMock.mock.calls.filter(([url]) => url === '/api/session'),
  ).toHaveLength(2);
  expect(createClient).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls.at(-1)![1]).toMatchObject({
    method: 'GET',
    cache: 'no-store',
  });
});
it('retries failed initialization and preserves structured API errors', async () => {
  fetchMock.mockResolvedValueOnce(json({ error: 'Unavailable' }, 503));
  const { api, ApiError } = await import('../src/lib/client/api');
  await expect(api('/room')).rejects.toBeInstanceOf(ApiError);
  fetchMock
    .mockResolvedValueOnce(json({ backend: 'local' }))
    .mockResolvedValueOnce(json({}))
    .mockResolvedValueOnce(json({ error: 'Invalid guess' }, 422));
  await expect(api('/room', { type: 'guess' })).rejects.toMatchObject({
    message: 'Invalid guess',
    status: 422,
  });
  expect(fetchMock.mock.calls.at(-1)![1]).toMatchObject({
    method: 'POST',
    body: '{"type":"guess"}',
    headers: { 'Content-Type': 'application/json' },
  });
});
it('loads hosted auth on demand, signs in once and reads fresh access tokens', async () => {
  const getSession = vi
    .fn()
    .mockResolvedValueOnce({ data: { session: null }, error: null })
    .mockResolvedValue({ data: { session: { access_token: 'token' } } });
  const signInAnonymously = vi.fn().mockResolvedValue({ error: null });
  createClient.mockReturnValue({ auth: { getSession, signInAnonymously } });
  fetchMock
    .mockResolvedValueOnce(
      json({
        backend: 'supabase',
        url: 'https://example.supabase.co',
        key: 'public-key',
      }),
    )
    .mockImplementation(async () => json({ ok: true }));
  const { api } = await import('../src/lib/client/api');
  expect(createClient).not.toHaveBeenCalled();
  await api('/room');
  await api('/room');
  expect(createClient).toHaveBeenCalledOnce();
  expect(signInAnonymously).toHaveBeenCalledOnce();
  expect(getSession).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls.at(-1)![1]?.headers).toEqual({
    Authorization: 'Bearer token',
  });
});
