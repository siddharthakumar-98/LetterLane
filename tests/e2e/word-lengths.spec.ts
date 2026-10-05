import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { RoomView } from '../../src/lib/game/types';

for (const [length, level, answer, guess] of [
  [6, 'Medium', 'GARDEN', 'BRIDGE'],
  [7, 'Hard', 'JOURNEY', 'PICTURE'],
] as const) {
  test(`${length}-letter ${level} rooms validate, restore, solve and rematch with a bot`, async ({
    page,
  }, testInfo) => {
    await page.goto('/');
    const difficulty = page.getByRole('group', {
      name: 'Word difficulty',
      exact: true,
    });
    await expect(
      difficulty.getByRole('radio', { name: 'Easy 5 letters' }),
    ).toBeChecked();
    await difficulty
      .getByRole('radio', { name: `${level} ${length} letters` })
      .check();
    await page.getByLabel('What should we call you?').fill('Long words');
    await page
      .getByRole('group', { name: 'Bot difficulty', exact: true })
      .getByRole('radio', { name: 'Hard', exact: true })
      .check();
    await page.getByRole('button', { name: 'Create a private room' }).click();
    await expect(page).toHaveURL(/\/room\//);
    await expect(
      page.getByText(`YOUR PRIVATE ROOM · ${level} · ${length} letters`),
    ).toBeVisible();
    const snapshot = () =>
      page.evaluate(
        async () =>
          (
            await fetch(`/api/rooms/${location.pathname.split('/').at(-1)}`)
          ).json() as Promise<RoomView>,
      );
    expect((await snapshot()).wordLength).toBe(length);
    await expect(
      page.getByRole('navigation', { name: 'Game mode' }),
    ).toHaveCount(0);
    await page.reload();
    expect((await snapshot()).wordLength).toBe(length);
    await page
      .getByRole('button', { name: 'How to play', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toContainText(
      `${length} letters. Six chances.`,
    );
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'I’m ready', exact: true }).click();
    await page
      .getByRole('button', { name: 'Play with bot', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Submit guess' }),
    ).toBeEnabled();
    // Words shows only the active row until guesses are submitted.
    await expect(page.locator('.your-lane .board .tile')).toHaveCount(length);
    await expect(
      page.locator('.masked-row').first().locator('.masked-tile'),
    ).toHaveCount(length);
    const before = await snapshot();
    // Bypass the UI to verify that the room's length is authoritative.
    const invalid = await page.evaluate(
      async ({ matchId, length }) => {
        const responses = [];
        for (const word of ['CRANE', 'Z'.repeat(length)]) {
          const response = await fetch(
            `/api/rooms/${location.pathname.split('/').at(-1)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'guess',
                word,
                matchId,
                requestId: crypto.randomUUID(),
              }),
            },
          );
          responses.push(response.status);
        }
        return responses;
      },
      { matchId: before.match.id, length },
    );
    expect(invalid).toEqual([422, 422]);
    expect((await snapshot()).players[0].count).toBe(0);
    expect((await snapshot()).players[0].timerEndsAt).toBe(
      before.players[0].timerEndsAt,
    );
    // On-screen entry, dictionary rejection, editing, and a valid submission.
    for (let i = 0; i < length; i++)
      await page.getByRole('button', { name: 'Z', exact: true }).click();
    await page.getByRole('button', { name: 'Submit guess' }).click();
    await expect(page.locator('.guess-feedback')).toContainText(
      'not in our dictionary',
    );
    for (let i = 0; i < length; i++)
      await page.getByRole('button', { name: 'Delete letter' }).click();
    await page.getByRole('heading', { name: 'Your lane', exact: true }).click();
    await page.keyboard.type(guess);
    await page.keyboard.press('Enter');
    await expect(page.locator('.your-lane .revealed')).toHaveCount(1);
    await page.reload();
    await expect(page.locator('.your-lane .revealed')).toHaveCount(1);
    await expect
      .poll(async () => (await snapshot()).players.find((p) => p.isBot)?.count)
      .toBeGreaterThan(0);
    const active = await snapshot();
    const bot = active.players.find((p) => p.isBot)!;
    expect(bot.guessMarks[0]).toHaveLength(length);
    expect(bot).not.toHaveProperty('attempts');
    expect(active.match).not.toHaveProperty('answer');
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('long-word-game.png'),
      fullPage: true,
    });
    await page.getByRole('heading', { name: 'Your lane', exact: true }).click();
    await page.keyboard.type(answer);
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', { name: 'This lane is yours.' }),
    ).toBeVisible();
    await expect(page.locator('.answer-reveal .tile')).toHaveCount(length);
    await expect(
      page
        .getByRole('group', { name: "Long words's revealed guesses" })
        .locator('.tile'),
    ).toHaveCount(length * 6);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('long-word-results.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'One more round' }).click();
    await expect(
      page.getByRole('button', { name: 'Submit guess' }),
    ).toBeEnabled();
    expect((await snapshot()).wordLength).toBe(length);
    expect((await snapshot()).match.round).toBe(2);
    // Words shows only the active row until guesses are submitted.
    await expect(page.locator('.your-lane .board .tile')).toHaveCount(length);
  });
}

test('Phrases does not offer word-length difficulty', async ({ page }) => {
  await page.goto('/phrases');
  await expect(
    page.getByRole('group', { name: 'Word difficulty', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('group', { name: 'Bot difficulty', exact: true }),
  ).toBeVisible();
});
