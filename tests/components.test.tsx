import { BotNotice, BotTag } from '../src/components/bot-notice';
import { projectRoom } from '../src/lib/game/rules';
import { fixture, p1 } from './fixtures';
// @vitest-environment jsdom
import { afterEach, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { Board, MaskedBoard } from '../src/components/board';
import { Keyboard } from '../src/components/keyboard';
import { scoreGuess } from '../src/lib/game/scoring';
afterEach(cleanup);
it('announces evaluated letters and renders six rows', () => {
  render(
    <Board
      attempts={[
        {
          word: 'ALLEY',
          marks: scoreGuess('APPLE', 'ALLEY'),
          elapsedMs: 100,
          requestId: 'test',
        },
      ]}
    />,
  );
  expect(
    screen.getByLabelText(
      /Guess 1: A correct, L present, L absent, E present, Y absent/,
    ),
  ).toBeTruthy();
  expect(screen.getByLabelText('Guess 6, empty')).toBeTruthy();
});
it('opponent board shows evaluated colors and accessible descriptions without letters', () => {
  const { container } = render(
    <MaskedBoard
      count={2}
      guessMarks={[
        ['present', 'absent', 'absent', 'present', 'absent'],
        ['present', 'absent', 'correct', 'absent', 'present'],
      ]}
    />,
  );
  expect(screen.getByRole('group').getAttribute('aria-label')).toContain(
    '2 of 6',
  );
  expect(
    screen.getByRole('img', {
      name: 'Opponent guess 2: yellow, grey, green, grey, yellow',
    }),
  ).toBeTruthy();
  expect(container.querySelectorAll('.correct')).toHaveLength(1);
  expect(container.querySelectorAll('.present')).toHaveLength(4);
  expect(container.querySelectorAll('.absent')).toHaveLength(5);
  expect(container.querySelectorAll('.masked-tile')).toHaveLength(30);
  expect(
    [...container.querySelectorAll('.masked-tile')].every(
      (tile) => tile.textContent === '',
    ),
  ).toBe(true);
  expect(
    screen.getByRole('img', { name: 'Opponent guess 3: empty' }),
  ).toBeTruthy();
});
it('opponent phrase colors follow word boundaries and include blue without letter or punctuation tiles', () => {
  const { container } = render(
    <MaskedBoard
      count={1}
      template="___ ___'_"
      guessMarks={[
        [
          'correct',
          'present',
          'elsewhere',
          'absent',
          'correct',
          'absent',
          'present',
        ],
      ]}
    />,
  );
  expect(
    screen.getByRole('img', {
      name: 'Opponent guess 1: green, orange, blue, grey, green, grey, orange',
    }),
  ).toBeTruthy();
  const row = container.querySelector('.masked-row')!;
  expect(
    [...row.querySelectorAll('.masked-word')].map(
      (word) => word.children.length,
    ),
  ).toEqual([3, 4]);
  expect(row.querySelectorAll('.elsewhere')).toHaveLength(1);
  expect(
    [...row.querySelectorAll('.masked-tile')].every(
      (tile) => tile.textContent === '',
    ),
  ).toBe(true);
  expect(container.querySelectorAll('.masked-tile')).toHaveLength(42);
});
it('keeps a neutral fallback for snapshots without color history', () => {
  const { container } = render(<MaskedBoard count={2} />);
  expect(container.querySelectorAll('.filled')).toHaveLength(10);
});
it('keyboard supports accessible submit/delete and disabled interaction', () => {
  const onKey = vi.fn();
  const { rerender } = render(
    <Keyboard attempts={[]} onKey={onKey} disabled={false} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Submit guess' }));
  expect(onKey).toHaveBeenCalledWith('Enter');
  fireEvent.click(screen.getByRole('button', { name: 'Delete letter' }));
  expect(onKey).toHaveBeenCalledWith('Backspace');
  rerender(<Keyboard attempts={[]} onKey={onKey} disabled />);
  fireEvent.click(screen.getByRole('button', { name: 'A' }));
  expect(onKey).toHaveBeenCalledTimes(2);
});

it('explains the explicit bot choice and clearly identifies an assigned bot', () => {
  const room = fixture();
  room.match.phase = 'lobby';
  room.players = room.players.slice(0, 1);
  const view = projectRoom(room, p1, 1000);
  const { rerender } = render(<BotNotice room={view} />);
  expect(
    screen.getByText('Ready up to choose a bot, or wait for a friend to join.'),
  ).toBeTruthy();
  view.players[0].ready = true;
  rerender(<BotNotice room={view} />);
  expect(
    screen.getByText(
      'Keep waiting for a friend, or choose Play with bot to start now.',
    ),
  ).toBeTruthy();
  view.players.push({
    ...view.players[0],
    id: 'bot',
    name: 'Pip',
    isBot: true,
  });
  rerender(<BotNotice room={view} />);
  expect(screen.getByRole('status').textContent).toContain(
    'Pip is your bot opponent.',
  );
  view.mode = 'coop';
  rerender(<BotNotice room={view} />);
  expect(screen.getByRole('status').textContent).toContain('bot teammate');
});
it('does not offer a bot once two humans join', () => {
  const { container } = render(
    <BotNotice room={projectRoom(fixture(), p1, 1000)} />,
  );
  expect(container.textContent).toBe('');
});
it('labels bot identities visibly', () => {
  render(<BotTag />);
  expect(screen.getByText('BOT')).toBeTruthy();
});

it.each([
  ['easy', 'Pipsqueak', 'Easy'],
  ['medium', 'Pipper', 'Medium'],
  ['hard', 'Pip', 'Hard'],
] as const)(
  'announces the selected %s companion before and after arrival',
  (difficulty, name, label) => {
    const room = fixture();
    room.botDifficulty = difficulty;
    room.match.phase = 'lobby';
    room.players = room.players.slice(0, 1);
    const view = projectRoom(room, p1, 1000);
    const { rerender } = render(<BotNotice room={view} />);
    expect(screen.getByText(`${name} · ${label} difficulty`)).toBeTruthy();
    view.players.push({ ...view.players[0], id: 'bot', name, isBot: true });
    rerender(<BotNotice room={view} />);
    expect(screen.getByRole('status').textContent).toContain(
      `${name} is your bot opponent.`,
    );
    expect(screen.getByRole('status').textContent).toContain(
      `${label} difficulty.`,
    );
    view.mode = 'coop';
    rerender(<BotNotice room={view} />);
    expect(screen.getByRole('status').textContent).toContain(
      `${name} is your bot teammate.`,
    );
  },
);
