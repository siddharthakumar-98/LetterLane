// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RoomGame } from '../src/components/room-game';
import { useRoom } from '../src/lib/client/use-room';
import { projectRoom } from '../src/lib/game/rules';
import { keyboardMarks } from '../src/lib/game/scoring';
import { fixture, p1 } from './fixtures';

vi.mock('../src/lib/client/use-room', () => ({ useRoom: vi.fn() }));
vi.mock('../src/lib/client/api', () => ({
  api: vi.fn().mockResolvedValue({ valid: [] }),
}));
vi.mock('../src/components/chrome', () => ({
  Header: () => null,
  Footer: () => null,
}));
vi.mock('../src/lib/game/scoring', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../src/lib/game/scoring')>();
  return { ...original, keyboardMarks: vi.fn(original.keyboardMarks) };
});
const actRoom = vi.fn().mockResolvedValue(true);
const setError = vi.fn();
function state() {
  return {
    room: projectRoom(fixture(), p1, 2000),
    error: '',
    fatal: null,
    connected: true,
    loading: false,
    busy: false,
    now: 2000,
    act: actRoom,
    refresh: vi.fn(),
    setError,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  actRoom.mockResolvedValue(true);
  vi.mocked(useRoom).mockReturnValue(state());
});
afterEach(cleanup);
const type = (letters: string) => {
  for (const key of letters) fireEvent.keyDown(window, { key });
};
it('shares physical and on-screen input, caps length and keeps histories stable on clock ticks', async () => {
  const current = state();
  vi.mocked(useRoom).mockReturnValue(current);
  const { container, rerender } = render(<RoomGame code="ABCDEF" />);
  expect(keyboardMarks).toHaveBeenCalledOnce();
  vi.mocked(useRoom).mockReturnValue({ ...current, now: 2100 });
  rerender(<RoomGame code="ABCDEF" />);
  expect(keyboardMarks).toHaveBeenCalledOnce();
  type('SLATEX');
  expect(
    [...container.querySelectorAll('.tile.typed')]
      .map((tile) => tile.textContent)
      .join(''),
  ).toBe('SLATE');
  fireEvent.click(screen.getByRole('button', { name: 'Delete letter' }));
  fireEvent.click(screen.getByRole('button', { name: 'E' }));
  await act(async () => fireEvent.keyDown(window, { key: 'Enter' }));
  expect(actRoom).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'guess',
      word: 'SLATE',
      matchId: current.room.match.id,
    }),
  );
  expect(container.querySelectorAll('.tile.typed')).toHaveLength(0);
});
it('retains the draft and request identity after a failed submission, and prevents concurrent submissions', async () => {
  let resolve!: (success: boolean) => void;
  actRoom.mockImplementationOnce(
    () =>
      new Promise<boolean>((done) => {
        resolve = done;
      }),
  );
  const { container } = render(<RoomGame code="ABCDEF" />);
  type('CRANE');
  fireEvent.keyDown(window, { key: 'Enter' });
  fireEvent.keyDown(window, { key: 'Enter' });
  fireEvent.keyDown(window, { key: 'Backspace' });
  expect(actRoom).toHaveBeenCalledTimes(1);
  await act(async () => resolve(false));
  expect(container.querySelectorAll('.tile.typed')).toHaveLength(5);
  await act(async () => fireEvent.keyDown(window, { key: 'Enter' }));
  expect(actRoom.mock.calls[1][0]).toEqual(actRoom.mock.calls[0][0]);
});
it('ignores shortcuts, repeated keys, focused controls and open dialogs', () => {
  const { container } = render(<RoomGame code="ABCDEF" />);
  for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'repeat'])
    fireEvent.keyDown(window, { key: 'A', [modifier]: true });
  fireEvent.keyDown(screen.getByRole('button', { name: 'A' }), {
    key: 'A',
  });
  const dialog = document.createElement('dialog');
  dialog.open = true;
  document.body.append(dialog);
  type('A');
  dialog.remove();
  expect(container.querySelectorAll('.tile.typed')).toHaveLength(0);
});
it.each(['countdown', 'complete', 'disconnected', 'expired', 'busy'])(
  'blocks guesses when %s',
  (status) => {
    const current = state();
    if (status === 'countdown' || status === 'complete')
      current.room.match.phase = status;
    if (status === 'disconnected') current.connected = false;
    if (status === 'expired') current.now = 100000;
    if (status === 'busy') current.busy = true;
    vi.mocked(useRoom).mockReturnValue(current);
    render(<RoomGame code="ABCDEF" />);
    type('CRANE');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(actRoom).not.toHaveBeenCalled();
  },
);
