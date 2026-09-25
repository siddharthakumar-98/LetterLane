import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { RoomView } from '../../src/lib/game/types';

for (const game of ['words', 'phrases'] as const) {
  test(`a ready solo player chooses a bot in ${game}, plays, reconnects and rematches`, async ({
    page,
  }, testInfo) => {
    await page.goto(game === 'phrases' ? '/phrases' : '/');
    await page.getByLabel('What should we call you?').fill('Solo');
    await page.getByRole('radio', { name: 'Hard', exact: true }).check();
    await page.getByRole('button', { name: 'Create a private room' }).click();
    await expect(page).toHaveURL(/\/room\/[A-Z2-9]{6}/);
    const code = page.url().split('/').at(-1)!;
    const snapshot = () =>
      page.evaluate(
        async (c) =>
          (await fetch(`/api/rooms/${c}`)).json() as Promise<RoomView>,
        code,
      );
    const initial = await snapshot();
    expect(initial.players).toHaveLength(1);
    await expect(page.getByText('Waiting for a second player')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Play with bot', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'I’m ready', exact: true }).click();
    await page.reload();
    const restored = await snapshot();
    expect(restored.createdAt).toBe(initial.createdAt);
    expect(restored.players[0].ready).toBe(true);
    expect(restored.players).toHaveLength(1);
    await page
      .getByRole('button', { name: 'Play with bot', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Play with bot', exact: true }),
    ).toHaveCount(0);
    await expect.poll(async () => (await snapshot()).players.length).toBe(2);
    await expect(
      page.getByRole('button', { name: 'Submit guess' }),
    ).toBeEnabled();
    await expect(page.getByText('BOT', { exact: true })).toBeVisible();
    await expect(page.getByText('Bot · ready to play')).toBeVisible();
    await expect
      .poll(
        async () => (await snapshot()).players.find((p) => p.isBot)?.count,
        {
          timeout: 15_000,
        },
      )
      .toBe(1);
    const active = await snapshot();
    const bot = active.players.find((p) => p.isBot)!;
    expect(bot).not.toHaveProperty('attempts');
    expect(active.match).not.toHaveProperty('answer');
    expect(active).not.toHaveProperty('botNextGuessAt');
    await page.reload();
    await expect(
      page.getByRole('img', {
        name: 'Opponent has used 1 of 6 guesses. Letters are hidden.',
      }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('bot-game.png'),
      fullPage: true,
    });
    await page.getByRole('heading', { name: 'Your lane', exact: true }).click();
    if (game === 'phrases') {
      await page.keyboard.type('ACTIONSSPEAKLOUDERTHANWORDS');
      await page.keyboard.press('Enter');
    } else {
      await page.keyboard.type('CRANE');
      await page.keyboard.press('Enter');
    }
    await expect(
      page.getByRole('heading', { name: 'This lane is yours.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('group', { name: "Pip's revealed guesses" }),
    ).toBeVisible();
    await expect(
      page.getByText('Pip is ready for another round whenever you are.'),
    ).toBeVisible();
    const ended = await snapshot();
    expect(ended.players.find((p) => p.isBot)?.rematch).toBe(true);
    await page.getByRole('button', { name: 'One more round' }).click();
    await expect(
      page.getByRole('button', { name: 'Submit guess' }),
    ).toBeEnabled();
    const next = await snapshot();
    expect(next.match.round).toBe(2);
    expect(next.players.find((p) => p.isBot)?.id).toBe(bot.id);
    expect(next.players.every((p) => p.count === 0)).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test('difficulty selection is accessible and survives room creation and reload', async ({
  page,
}, testInfo) => {
  for (const [difficulty, name, label] of [
    ['easy', 'Pipsqueak', 'Easy'],
    ['medium', 'Pipper', 'Medium'],
    ['hard', 'Pip', 'Hard'],
  ] as const) {
    await page.goto('/');
    await expect(
      page.getByRole('radio', { name: 'Medium', exact: true }),
    ).toBeChecked();
    await page.getByLabel('What should we call you?').fill('Solo');
    await page.getByRole('radio', { name: label, exact: true }).check();
    if (difficulty === 'medium') {
      await page.getByRole('radio', { name: /Better together/ }).check();
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath('difficulty-picker.png'),
        fullPage: true,
      });
    }
    await page.getByRole('button', { name: 'Create a private room' }).click();
    await expect(page).toHaveURL(/\/room\/[A-Z2-9]{6}/);
    await expect(page.getByText(`${name} · ${label} difficulty`)).toBeVisible();
    await page.reload();
    await expect(page.getByText(`${name} · ${label} difficulty`)).toBeVisible();
    const snapshot = await page.evaluate(async () => {
      const code = location.pathname.split('/').at(-1);
      return (await fetch(`/api/rooms/${code}`)).json();
    });
    expect(snapshot.botDifficulty).toBe(difficulty);
    expect(snapshot.mode).toBe(difficulty === 'medium' ? 'coop' : 'duel');
    expect(snapshot.players).toHaveLength(1);
    expect(snapshot.match).not.toHaveProperty('answer');
  }
});
