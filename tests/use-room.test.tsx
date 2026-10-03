// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api, identity } from '../src/lib/client/api';
import { useRoom } from '../src/lib/client/use-room';
import { projectRoom } from '../src/lib/game/rules';
import { fixture, p1 } from './fixtures';
import type { RoomView } from '../src/lib/game/types';
vi.mock('../src/lib/client/api', () => ({
  api: vi.fn(),
  identity: vi.fn(),
  ApiError: class extends Error {
    constructor(
      message: string,
      public status: number,
    ) {
      super(message);
    }
  },
}));
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(2000);
  vi.mocked(api).mockReset();
  vi.mocked(identity).mockResolvedValue(null);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const tick = (ms = 0) => act(() => vi.advanceTimersByTimeAsync(ms));
it('coalesces overlapping refreshes, keeps presence heartbeats and stops timers on unmount', async () => {
  const room = projectRoom(fixture(), p1, 2000);
  let resolve!: (room: RoomView) => void;
  vi.mocked(api).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { result, unmount } = renderHook(() => useRoom('ABCDEF'));
  await tick(1000);
  await act(async () => result.current.refresh());
  expect(api).toHaveBeenCalledTimes(1);
  await act(async () => resolve(room));
  expect(result.current.loading).toBe(false);
  vi.mocked(api).mockResolvedValue(room);
  await tick(5000);
  expect(api).toHaveBeenCalledWith('/api/rooms/ABCDEF', { type: 'heartbeat' });
  unmount();
  const calls = vi.mocked(api).mock.calls.length;
  await tick(10000);
  expect(api).toHaveBeenCalledTimes(calls);
});
it('does not roll back accepted guesses or the server clock when an older poll finishes last', async () => {
  const room = projectRoom(fixture(), p1, 2000);
  vi.mocked(api).mockResolvedValueOnce(room);
  const { result } = renderHook(() => useRoom('ABCDEF'));
  await tick();
  let resolve!: (room: RoomView) => void;
  vi.mocked(api).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  let refresh!: Promise<void>;
  act(() => {
    refresh = result.current.refresh();
  });
  const next = structuredClone(room);
  next.revision++;
  next.serverTime = 5000;
  next.players[0].count = 1;
  vi.mocked(api).mockResolvedValueOnce(next);
  await act(async () => {
    await result.current.act({ type: 'ready' });
  });
  await act(async () => {
    resolve(room);
    await refresh;
  });
  await tick(100);
  expect(result.current.room?.players[0].count).toBe(1);
  expect(result.current.now).toBe(5100);
});
it('recovers on an online event without dropping accepted state during a failed poll', async () => {
  const room = projectRoom(fixture(), p1, 2000);
  vi.mocked(api)
    .mockResolvedValueOnce(room)
    .mockRejectedValueOnce(new Error('offline'));
  const { result } = renderHook(() => useRoom('ABCDEF'));
  await tick(1000);
  expect(result.current.connected).toBe(false);
  expect(result.current.room).toEqual(room);
  vi.mocked(api).mockResolvedValue(room);
  await act(async () => window.dispatchEvent(new Event('online')));
  expect(result.current.connected).toBe(true);
});
