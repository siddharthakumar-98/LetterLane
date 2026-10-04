import { expect, test, type Page } from '@playwright/test';
import { fixture, p1 } from '../fixtures';
import { projectRoom } from '../../src/lib/game/rules';
import { playableLetters, scorePhrase } from '../../src/lib/game/phrases';
import { scoreGuess } from '../../src/lib/game/scoring';
import type {
  GameKind,
  Mode,
  PhraseDifficulty,
  Room,
  WordLength,
} from '../../src/lib/game/types';

const viewports = [
  { width: 320, height: 740 },
  { width: 390, height: 844 },
  { width: 640, height: 900 },
  { width: 768, height: 1024 },
  { width: 960, height: 800 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
];
async function contained(page: Page, selector: string) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const violations = await page.locator(selector).evaluateAll((elements) =>
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      return rect.left < -1 ||
        rect.right > innerWidth + 1 ||
        element.scrollWidth > element.clientWidth + 2
        ? [
            `${element.className}: ${Math.round(rect.width)}px, content ${element.scrollWidth}px`,
          ]
        : [];
    }),
  );
  expect(violations).toEqual([]);
}

// The existing suite exercises real gameplay; these public snapshots hold each
// phase steady so the responsive matrix does not race timers or bot turns.
test.describe('responsive layout matrix', () => {
  test.skip(
    ({ isMobile }) => isMobile,
    'The matrix explicitly covers both mobile and desktop viewports.',
  );
  for (const game of ['words', 'phrases'] as const) {
    test(`${game} home uses desktop columns and a compact mobile flow`, async ({
      page,
    }, testInfo) => {
      await page.goto(game === 'words' ? '/' : '/phrases');
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await contained(
          page,
          '.home-intro, .home-setup, .start-form, .mode-picker label, .difficulty-options label, .join-form',
        );
        const layout = await page.locator('.start-panel').evaluate((panel) => {
          const intro = panel
            .querySelector('.home-intro')!
            .getBoundingClientRect();
          const setup = panel
            .querySelector('.home-setup')!
            .getBoundingClientRect();
          const pickers = [...panel.querySelectorAll('.difficulty-picker')].map(
            (element) => element.getBoundingClientRect(),
          );
          return {
            columns: intro.right <= setup.left,
            stacked: intro.bottom <= setup.top,
            difficultyColumns: pickers[0].right <= pickers[1].left,
            difficultyStacked: pickers[0].bottom <= pickers[1].top,
          };
        });
        expect(viewport.width > 960 ? layout.columns : layout.stacked).toBe(
          true,
        );
        expect(
          viewport.width > 640
            ? layout.difficultyColumns
            : layout.difficultyStacked,
        ).toBe(true);
        if (viewport.width >= 1024) {
          const button = await page
            .getByRole('button', { name: 'Create a private room' })
            .boundingBox();
          expect(button!.y + button!.height).toBeLessThan(viewport.height);
        }
        await page.screenshot({
          path: testInfo.outputPath(`${game}-home-${viewport.width}.png`),
          fullPage: true,
        });
        await page.getByRole('button', { name: 'How to play' }).click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await contained(page, '.how-dialog');
        const bounds = await dialog.boundingBox();
        expect(bounds!.y).toBeGreaterThanOrEqual(0);
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
        await page.getByRole('button', { name: 'Close instructions' }).click();
        await expect(dialog).not.toBeVisible();
      }
      await expect(page.getByText('A GOOD KIND OF COMPETITION')).toHaveCount(0);
      await expect(
        page.locator('.lucide-sparkles, .preview-result'),
      ).toHaveCount(0);
    });
  }

  const puzzles: {
    game: GameKind;
    length?: WordLength;
    difficulty?: PhraseDifficulty;
    answer: string;
    guess: string;
  }[] = [
    { game: 'words', length: 5, answer: 'CRANE', guess: 'SLATE' },
    { game: 'words', length: 6, answer: 'GARDEN', guess: 'BRIDGE' },
    { game: 'words', length: 7, answer: 'JOURNEY', guess: 'PICTURE' },
    {
      game: 'phrases',
      difficulty: 'easy',
      answer: 'ACTIONS SPEAK LOUDER THAN WORDS',
      guess: 'CAPTION BREAK MOTHER THEN WORLD',
    },
    {
      game: 'phrases',
      difficulty: 'normal',
      answer: "A LEOPARD CAN'T CHANGE ITS SPOTS",
      guess: "A LEOPARD CAN'T CHANGE ITS SPOTS",
    },
  ];
  for (const puzzle of puzzles) {
    for (const mode of ['duel', 'coop'] as Mode[]) {
      test(`${puzzle.game} ${puzzle.length ?? puzzle.difficulty} ${mode} lobby, countdown, game and results fit`, async ({
        page,
      }, testInfo) => {
        const room = fixture();
        room.game = puzzle.game;
        room.wordLength = puzzle.length;
        room.phraseDifficulty = puzzle.difficulty;
        room.mode = mode;
        room.match.answer = puzzle.answer;
        room.players[0].name = 'TwentyCharacterNameX';
        room.players[1].name = 'AnotherLongPlayerOne';
        await page.route('**/api/rooms/ABCDEF', (route) => {
          const now = Date.now();
          room.expiresAt = now + 86400000;
          room.match.startsAt =
            room.match.phase === 'lobby'
              ? null
              : now + (room.match.phase === 'countdown' ? 3000 : -2000);
          room.players.forEach((player) => {
            player.lastSeen = now;
          });
          return route.fulfill({ json: projectRoom(room, p1, now) });
        });
        for (const phase of [
          'lobby',
          'countdown',
          'active',
          'complete',
        ] as Room['match']['phase'][]) {
          room.match.phase = phase;
          const completed = phase === 'complete';
          room.match.outcome = completed
            ? mode === 'duel'
              ? 'solved'
              : 'team-win'
            : null;
          room.match.winnerId = completed && mode === 'duel' ? p1 : null;
          room.players.forEach((player) => {
            player.ready = phase !== 'lobby';
            player.attempts =
              phase === 'lobby' || phase === 'countdown'
                ? []
                : [
                    {
                      word:
                        puzzle.game === 'phrases'
                          ? playableLetters(
                              completed ? puzzle.answer : puzzle.guess,
                            )
                          : completed
                            ? puzzle.answer
                            : puzzle.guess,
                      marks:
                        puzzle.game === 'phrases'
                          ? scorePhrase(
                              puzzle.answer,
                              completed ? puzzle.answer : puzzle.guess,
                            )
                          : scoreGuess(
                              puzzle.answer,
                              completed ? puzzle.answer : puzzle.guess,
                            ),
                      elapsedMs: 1000,
                      requestId: 'layout-attempt',
                    },
                  ];
          });
          for (const viewport of [
            viewports[0],
            viewports[1],
            viewports[3],
            viewports[5],
            viewports[6],
            viewports[7],
          ]) {
            await page.setViewportSize(viewport);
            await page.goto('/room/ABCDEF');
            await page
              .locator(
                phase === 'lobby'
                  ? '.lobby'
                  : completed
                    ? '.results'
                    : '.arena',
              )
              .waitFor();
            await contained(
              page,
              '.lobby-main, .lobby-seats, .player-badge, .match-header, .match-player, .your-lane, .opponent-lane, .board, .phrase-word, .keyboard, .masked-board, .result-player, .answer-reveal, .results-actions',
            );
            if (phase === 'active' || phase === 'countdown') {
              await expect(page.locator('.match-player')).toHaveCount(2);
              for (const side of await page.locator('.match-player').all()) {
                await expect(side.getByRole('timer')).toHaveCount(1);
                await expect(side.locator('.player-badge')).toBeVisible();
              }
              await expect(
                page.locator(
                  '.arena-timers, .arena-legend, .opponent-description, .opponent-note',
                ),
              ).toHaveCount(0);
              const lanes = await page.locator('.arena').evaluate((arena) => {
                const self = arena
                  .querySelector('.your-lane')!
                  .getBoundingClientRect();
                const opponent = arena
                  .querySelector('.opponent-lane')!
                  .getBoundingClientRect();
                return {
                  columns: self.right <= opponent.left,
                  stacked: self.bottom <= opponent.top,
                  aligned: Math.abs(self.top - opponent.top) < 1,
                };
              });
              expect(
                viewport.width > 640
                  ? lanes.columns && lanes.aligned
                  : lanes.stacked,
              ).toBe(true);
              if (viewport.width >= 768) {
                const bar = await page.locator('.match-header').boundingBox();
                expect(bar!.height).toBeLessThanOrEqual(90);
              }
            }
            if (completed) {
              const alignment = await page
                .getByRole('button', { name: 'One more round' })
                .evaluate((button) => {
                  const bounds = button.getBoundingClientRect();
                  const content = [...button.childNodes].flatMap((node) => {
                    if (
                      node.nodeType === Node.TEXT_NODE &&
                      !node.textContent?.trim()
                    )
                      return [];
                    const range = document.createRange();
                    range.selectNode(node);
                    return [range.getBoundingClientRect()];
                  });
                  const center = bounds.left + bounds.width / 2;
                  return {
                    buttonOffset: Math.abs(center - innerWidth / 2),
                    contentOffset: Math.abs(
                      (Math.min(...content.map((r) => r.left)) +
                        Math.max(...content.map((r) => r.right))) /
                        2 -
                        center,
                    ),
                  };
                });
              expect(alignment.contentOffset).toBeLessThan(2);
              if (viewport.width <= 640)
                expect(alignment.buttonOffset).toBeLessThan(2);
            }
            if (phase === 'active') {
              expect(
                await page
                  .locator('.key')
                  .evaluateAll((keys) =>
                    keys.every(
                      (key) => key.getBoundingClientRect().height >= 44,
                    ),
                  ),
              ).toBe(true);
            }
            if (viewport.width === 390 || viewport.width === 1280)
              await page.screenshot({
                path: testInfo.outputPath(`${phase}-${viewport.width}.png`),
                fullPage: true,
                animations: 'disabled',
              });
          }
        }
      });
    }
  }
});
