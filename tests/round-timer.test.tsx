// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RoomGame } from '../src/components/room-game';
import { useRoom } from '../src/lib/client/use-room';
import { projectRoom } from '../src/lib/game/rules';
import { scoreGuess } from '../src/lib/game/scoring';
import { fixture, p1 } from './fixtures';
vi.mock('../src/lib/client/use-room');
vi.mock('../src/components/chrome', () => ({
  Header: () => null,
  Footer: () => null,
}));
afterEach(cleanup);

it.each([false, true])(
  'shows both clocks (bot: %s), bonuses, and stops input at zero',
  (isBot) => {
    const room = fixture();
    if (isBot) {
      room.players[1].isBot = true;
      room.players[1].name = 'Pip';
    }
    const opponentLabel = isBot
      ? 'Pip · BOT remaining'
      : 'Max’s time remaining';
    room.match.phase = 'countdown';
    room.match.startsAt = 4000;
    const act = vi.fn();
    const show = (now: number) =>
      vi.mocked(useRoom).mockReturnValue({
        room: projectRoom(room, p1, now),
        now,
        error: '',
        fatal: null,
        connected: true,
        loading: false,
        busy: false,
        act,
        refresh: vi.fn(),
        setError: vi.fn(),
      });
    show(1000);
    const { rerender } = render(<RoomGame code={room.code} />);
    expect(
      screen.getByRole('timer', { name: 'Your time remaining' }).textContent,
    ).toBe('1:30');
    expect(
      (
        screen.getByRole('button', {
          name: 'Submit guess',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    room.match.phase = 'active';
    show(5000);
    rerender(<RoomGame code={room.code} />);
    expect(
      screen.getByRole('timer', { name: 'Your time remaining' }).textContent,
    ).toBe('1:29');
    expect(
      (
        screen.getByRole('button', {
          name: 'Submit guess',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);
    room.players[0].attempts.push({
      word: 'SLATE',
      marks: scoreGuess('CRANE', 'SLATE'),
      elapsedMs: 1000,
      requestId: 'accepted',
    });
    show(6000);
    rerender(<RoomGame code={room.code} />);
    expect(
      screen.getByRole('timer', { name: 'Your time remaining' }).textContent,
    ).toBe('2:08');
    expect(screen.getByText('+40s last guess')).toBeTruthy();
    expect(screen.getAllByRole('timer')).toHaveLength(2);
    expect(screen.getByRole('timer', { name: opponentLabel }).textContent).toBe(
      '1:28',
    );
    show(133999);
    rerender(<RoomGame code={room.code} />);
    expect(
      screen.getByRole('timer', { name: 'Your time remaining' }).textContent,
    ).toBe('0:01');
    show(134000);
    rerender(<RoomGame code={room.code} />);
    expect(
      screen.getByRole('timer', { name: 'Your time remaining' }).textContent,
    ).toBe('0:00');
    expect(
      (
        screen.getByRole('button', {
          name: 'Submit guess',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.keyDown(window, { key: 'C' });
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(act).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        `Your time is up. Waiting for ${isBot ? 'Pip' : 'your friend'}…`,
      ),
    ).toBeTruthy();
  },
);
