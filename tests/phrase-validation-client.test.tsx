// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../src/lib/client/api';
import { usePhraseValidation } from '../src/lib/client/use-phrase-validation';
vi.mock('../src/lib/client/api', () => ({ api: vi.fn() }));
beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(api).mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const tick = (ms = 200) => act(() => vi.advanceTimersByTimeAsync(ms));

it('debounces completed words, batches only unknown words and caches repeated checks', async () => {
  vi.mocked(api).mockResolvedValue({ valid: [false] });
  const { result, rerender } = renderHook(
    ({ input }) => usePhraseValidation('___ _____ ____', input, true),
    { initialProps: { input: 'GO' } },
  );
  await tick();
  expect(api).not.toHaveBeenCalled();
  expect(result.current).toBe('');
  rerender({ input: 'GOS' });
  await tick(100);
  rerender({ input: 'GOSN' });
  await tick(100);
  expect(api).toHaveBeenCalledWith('/api/phrases/validate', { words: ['GOS'] });
  expect(result.current).toBe('Word 1 is not in word list');
  vi.mocked(api).mockResolvedValue({ valid: [false, true] });
  rerender({ input: 'GOSNIFFSLUNG' });
  await tick();
  expect(api).toHaveBeenLastCalledWith('/api/phrases/validate', {
    words: ['NIFFS', 'LUNG'],
  });
  expect(result.current).toBe('Words 1 and 2 are not in word list');
  rerender({ input: 'GO' });
  expect(result.current).toBe('');
  rerender({ input: 'GOSNIFFSLUNG' });
  await tick();
  expect(api).toHaveBeenCalledTimes(2);
  expect(result.current).toBe('Words 1 and 2 are not in word list');
});
it('ignores stale responses after editing and removes errors immediately for incomplete words', async () => {
  let resolveOld!: (value: { valid: boolean[] }) => void;
  vi.mocked(api).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  const { result, rerender } = renderHook(
    ({ input }) => usePhraseValidation('___ ____', input, true),
    { initialProps: { input: 'GOS' } },
  );
  await tick();
  vi.mocked(api).mockResolvedValue({ valid: [true] });
  rerender({ input: 'CAT' });
  await tick();
  await act(async () => resolveOld({ valid: [false] }));
  expect(result.current).toBe('');
  vi.mocked(api).mockResolvedValue({ valid: [false] });
  rerender({ input: 'GOS' });
  await tick();
  expect(result.current).toBe('Word 1 is not in word list');
  rerender({ input: 'GO' });
  expect(result.current).toBe('');
});
it('deduplicates repeated words without losing their positions', async () => {
  vi.mocked(api).mockResolvedValue({ valid: [false] });
  const { result } = renderHook(() =>
    usePhraseValidation('___ ___ ___', 'GOSGOSGOS', true),
  );
  await tick();
  expect(api).toHaveBeenCalledWith('/api/phrases/validate', { words: ['GOS'] });
  expect(result.current).toBe('Words 1, 2, and 3 are not in word list');
});
it('does not make requests in Words mode or outside active play', async () => {
  const { rerender } = renderHook(
    ({ enabled }) => usePhraseValidation('___', 'GOS', enabled),
    { initialProps: { enabled: false } },
  );
  await tick();
  expect(api).not.toHaveBeenCalled();
  rerender({ enabled: true });
  rerender({ enabled: false });
  await tick();
  expect(api).not.toHaveBeenCalled();
});
it('leaves failed checks neutral without a retry loop, and can check again after editing', async () => {
  vi.mocked(api).mockRejectedValue(new Error('Offline'));
  const { result, rerender } = renderHook(
    ({ input }) => usePhraseValidation('___', input, true),
    { initialProps: { input: 'GOS' } },
  );
  await tick(10000);
  expect(api).toHaveBeenCalledTimes(1);
  expect(result.current).toBe('');
  vi.mocked(api).mockResolvedValue({ valid: [false] });
  rerender({ input: 'GO' });
  rerender({ input: 'GOS' });
  await tick();
  expect(result.current).toBe('Word 1 is not in word list');
});
