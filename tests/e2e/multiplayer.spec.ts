import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';
async function enterWord(page: Page, word: string) {
  await expect(
    page.getByRole('button', { name: 'Submit guess' }),
  ).toBeEnabled();
  await page.getByRole('heading', { name: 'Your lane', exact: true }).click();
  await page.keyboard.type(word);
  await page.keyboard.press('Enter');
}
test('two guests create, join, ready, play concurrently, reconnect, finish and rematch', async ({
  browser,
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const friendContext = await browser.newContext({
    ...testInfo.project.use,
    baseURL: 'http://127.0.0.1:3100',
  });
  const thirdContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3100',
  });
  const friend = await friendContext.newPage();
  const third = await thirdContext.newPage();
  try {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Two minds. One word.' }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('home.png'),
      fullPage: true,
    });
    await page.getByLabel('What should we call you?').fill('Ada');
    await page.getByRole('button', { name: 'Create a private room' }).click();
    await expect(page).toHaveURL(/\/room\/[A-Z2-9]{6}/);
    const url = page.url();
    const code = url.split('/').at(-1)!;
    await expect(
      page.getByRole('heading', { name: 'Save a seat for a friend.' }),
    ).toBeVisible();
    await friend.goto(url);
    await friend.getByLabel('Your display name').fill('Max');
    await friend.getByRole('button', { name: 'Join your friend' }).click();
    await expect(
      page.getByRole('heading', { name: 'Two minds, all set?' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Play with bot', exact: true }),
    ).toHaveCount(0);
    await third.goto('/');
    await third.getByLabel('What should we call you?').fill('Third');
    await third.getByLabel('Room code', { exact: true }).fill(code);
    await third.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(third.getByRole('main').getByRole('alert')).toContainText(
      'already has two players',
    );
    await Promise.all([
      page.getByRole('button', { name: 'I’m ready', exact: true }).click(),
      friend.getByRole('button', { name: 'I’m ready', exact: true }).click(),
    ]);
    await expect(page.getByText('MAKE YOURSELF READY')).toBeVisible();
    await expect(
      page.getByRole('timer', { name: 'Your time remaining' }),
    ).toHaveText('1:30');
    await expect(
      page.getByRole('button', { name: 'Submit guess' }),
    ).toBeEnabled();
    await expect(
      friend.getByRole('button', { name: 'Submit guess' }),
    ).toBeEnabled();
    const active = await page.evaluate(
      async (c) => (await fetch(`/api/rooms/${c}`)).json(),
      code,
    );
    expect(active.match.answer).toBeUndefined();
    await enterWord(page, 'ZZZZZ');
    await expect(
      page.getByText('That word is not in our dictionary. Try another.'),
    ).toBeVisible();
    expect(
      (
        await page.evaluate(
          async (c) => (await fetch(`/api/rooms/${c}`)).json(),
          code,
        )
      ).players[0].count,
    ).toBe(0);
    for (let i = 0; i < 5; i++) await page.keyboard.press('Backspace');
    await Promise.all([enterWord(page, 'SLATE'), enterWord(friend, 'APPLE')]);
    await expect(
      page.getByRole('img', {
        name: 'Opponent has used 1 of 6 guesses. Letters are hidden.',
      }),
    ).toBeVisible();
    await expect(
      friend.getByRole('img', {
        name: 'Opponent has used 1 of 6 guesses. Letters are hidden.',
      }),
    ).toBeVisible();
    const masked = await page.evaluate(
      async (c) => (await fetch(`/api/rooms/${c}`)).json(),
      code,
    );
    expect(JSON.stringify(masked)).not.toContain('APPLE');
    expect(masked.match).not.toHaveProperty('answer');
    expect(masked.players[0].timerEndsAt - masked.match.startsAt).toBe(130000);
    expect(masked.players[1].timerEndsAt - masked.match.startsAt).toBe(130000);
    await expect(
      page.getByRole('timer', { name: 'Max’s time remaining' }),
    ).toBeVisible();
    await expect(page.getByText('+40s last guess')).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('active.png'),
      fullPage: true,
    });
    await page.reload();
    await expect(page.getByLabel(/Guess 1: S absent/)).toBeVisible();
    await expect(page.getByText('+40s last guess')).toBeVisible();
    await friendContext.setOffline(true);
    await expect(
      friend.getByText(/Connection interrupted. Reconnecting/),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Your friend disconnected. They can rejoin this room with their progress intact.',
      ),
    ).toBeVisible({ timeout: 22000 });
    await friendContext.setOffline(false);
    await expect(
      friend.getByText(/Connection interrupted. Reconnecting/),
    ).not.toBeVisible();
    await expect(
      page.getByText(
        'Your friend disconnected. They can rejoin this room with their progress intact.',
      ),
    ).not.toBeVisible();
    await friend.reload();
    await expect(friend.getByLabel(/Guess 1: A present/)).toBeVisible();
    await enterWord(page, 'CRANE');
    await expect(
      page.getByRole('heading', { name: 'This lane is yours.' }),
    ).toBeVisible();
    await expect(
      friend.getByRole('heading', { name: 'Ada takes the lane.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('group', { name: "Max's revealed guesses" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('results.png'),
      fullPage: true,
    });
    await Promise.all([
      page.getByRole('button', { name: 'One more round' }).click(),
      friend.getByRole('button', { name: 'One more round' }).click(),
    ]);
    await expect(
      page.getByRole('button', { name: 'Submit guess' }),
    ).toBeEnabled();
    const next = await page.evaluate(
      async (c) => (await fetch(`/api/rooms/${c}`)).json(),
      code,
    );
    expect(next.match.round).toBe(2);
    expect(next.players[0].timerEndsAt - next.match.startsAt).toBe(90000);
    expect(next.players.every((p: { count: number }) => p.count === 0)).toBe(
      true,
    );
    expect(next.match).not.toHaveProperty('answer');
    await enterWord(friend, 'BLOOM');
    await expect(
      friend.getByRole('heading', { name: 'This lane is yours.' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await friendContext.close();
    await thirdContext.close();
  }
});
test('expanded dictionary guesses, co-op and invalid invitation states work', async ({
  browser,
  page,
}, testInfo) => {
  await page.goto('/room/ABC234');
  await expect(
    page.getByRole('heading', { name: 'A little lost?' }),
  ).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByLabel('What should we call you?').fill('Team A');
  await page.getByRole('radio', { name: /Better together/ }).check();
  await page.getByRole('button', { name: 'Create a private room' }).click();
  await expect(page).toHaveURL(/\/room\//);
  const context = await browser.newContext({ ...testInfo.project.use });
  const friend = await context.newPage();
  try {
    await friend.goto(page.url());
    await friend.getByLabel('Your display name').fill('Team B');
    await friend.getByRole('button', { name: 'Join your friend' }).click();
    await Promise.all([
      page.getByRole('button', { name: 'I’m ready', exact: true }).click(),
      friend.getByRole('button', { name: 'I’m ready', exact: true }).click(),
    ]);
    await expect(
      friend.getByRole('button', { name: 'Submit guess' }),
    ).toBeEnabled();
    for (const [index, word] of ['IRATE', 'PLOWS', 'LOOPS'].entries()) {
      await enterWord(page, word);
      await expect
        .poll(async () =>
          page.evaluate(async () => {
            const code = location.pathname.split('/').at(-1);
            const room = await (await fetch(`/api/rooms/${code}`)).json();
            return room.players[0].count;
          }),
        )
        .toBe(index + 1);
      await expect(
        page.getByText('That word is not in our dictionary. Try another.'),
      ).not.toBeVisible();
    }
    await enterWord(friend, 'CRANE');
    await expect(
      page.getByRole('heading', { name: 'A win for both of you.' }),
    ).toBeVisible();
    await expect(
      friend.getByRole('heading', { name: 'A win for both of you.' }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
