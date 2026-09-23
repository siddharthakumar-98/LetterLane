import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { RoomView } from '../../src/lib/game/types';

test('Words and Phrases switch cleanly, retain separate progress, validate, solve and rematch', async ({
  page,
  browser,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('link', { name: 'Letterlane Words', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByLabel('What should we call you?').fill('Word Player');
  await page.getByRole('button', { name: 'Create a private room' }).click();
  await expect(page).toHaveURL(/\/room\//);
  const wordsUrl = page.url();
  await page
    .getByRole('link', { name: 'Letterlane Phrases', exact: true })
    .click();
  await expect(page).toHaveURL('/phrases');
  await expect(
    page.getByRole('heading', { name: 'Two minds. One phrase.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Blue:');
  await expect(page.getByRole('dialog')).toContainText('another word');
  await page.keyboard.press('Escape');
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath('phrases-home.png'),
    fullPage: true,
  });
  await page.getByLabel('What should we call you?').fill('Phrase Player');
  await page.getByRole('radio', { name: /Better together/ }).check();
  await page.getByRole('button', { name: 'Create a private room' }).click();
  await expect(page).toHaveURL(/\/room\//);
  const phraseUrl = page.url();
  const snapshot = () =>
    page.evaluate(
      async () =>
        (
          await fetch(`/api/rooms/${location.pathname.split('/').at(-1)}`)
        ).json() as Promise<RoomView>,
    );
  const original = await snapshot();
  expect(original.game).toBe('phrases');
  expect(original.match.phraseTemplate).toBe('_______ _____ ______ ____ _____');
  expect(original.match).not.toHaveProperty('answer');
  const friendContext = await browser.newContext({ ...testInfo.project.use });
  const friend = await friendContext.newPage();
  try {
    await friend.goto(phraseUrl);
    await friend.getByLabel('Your display name').fill('Friend');
    await friend.getByRole('button', { name: 'Join your friend' }).click();
    await Promise.all([
      page.getByRole('button', { name: 'I’m ready', exact: true }).click(),
      friend.getByRole('button', { name: 'I’m ready', exact: true }).click(),
    ]);
    const input = page.getByLabel('Edit your phrase letters');
    await expect(input).toBeEnabled();
    await expect(page.locator('.phrase-board .tile')).toHaveCount(27);
    await expect(page.locator('.phrase-board .phrase-word')).toHaveCount(5);
    await input.fill('ACTIONS');
    await input.press('Enter');
    await expect(
      page.getByText('Fill all 27 letters before submitting.'),
    ).toBeVisible();
    for (const [guess, message] of [
      ['ACTIONS ZZZZZ LOUDER THAN WORDS', 'Word 2 is not in word list'],
      ['ZZZZZZZ SPEAK ZZZZZZ THAN WORDS', 'Words 1 and 3 are not in word list'],
      [
        'ZZZZZZZ ZZZZZ ZZZZZZ THAN WORDS',
        'Words 1, 2, and 3 are not in word list',
      ],
    ]) {
      await input.fill(guess);
      await input.press('Enter');
      await expect(page.getByText(message, { exact: true })).toBeVisible();
      expect((await snapshot()).players[0].count).toBe(0);
    }
    await input.fill('CAPTION BREAK MOTHER THEN WORLD');
    await input.press('Enter');
    await expect(
      page.getByRole('group', {
        name: 'Guess 1: CAPTION BREAK MOTHER THEN WORLD',
        exact: true,
      }),
    ).toBeVisible();
    const saved = await snapshot();
    expect(saved.players[0].count).toBe(1);
    expect(saved.players[0].attempts?.[0].marks).toContain('elsewhere');
    const friendView = await friend.evaluate(async () =>
      (await fetch(`/api/rooms/${location.pathname.split('/').at(-1)}`)).json(),
    );
    expect(friendView.players[0]).not.toHaveProperty('attempts');
    await page.reload();
    await expect(
      page.getByRole('group', {
        name: 'Guess 1: CAPTION BREAK MOTHER THEN WORLD',
        exact: true,
      }),
    ).toBeVisible();
    expect((await snapshot()).players[0].attempts).toEqual(
      saved.players[0].attempts,
    );
    // Words wrap as units, without clipped letters, on each viewport.
    expect(
      await page.locator('.phrase-board .phrase-word').evaluateAll((words) =>
        words.every((word) => {
          const box = word.getBoundingClientRect();
          return (
            box.right <= innerWidth &&
            box.left >= 0 &&
            [...word.querySelectorAll('.tile')].every((tile) => {
              const rect = tile.getBoundingClientRect();
              return rect.width >= 12 && Math.abs(rect.top - box.top) < 2;
            })
          );
        }),
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('phrases-active.png'),
      fullPage: true,
    });
    await input.fill('Actions speak louder than words');
    await input.press('Enter');
    await expect(
      page.getByRole('heading', { name: 'A win for both of you.' }),
    ).toBeVisible();
    await expect(page.getByText('THE PHRASE WAS')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('phrases-results.png'),
      fullPage: true,
    });
    await Promise.all([
      page.getByRole('button', { name: 'One more round' }).click(),
      friend.getByRole('button', { name: 'One more round' }).click(),
    ]);
    await expect(input).toBeEnabled();
    const rematch = await snapshot();
    expect(rematch.match.round).toBe(2);
    expect(rematch.match.phraseTemplate).toBe(
      "_ _______ ___'_ ______ ___ _____",
    );
    expect(rematch.players.every((player) => player.count === 0)).toBe(true);
    await expect(page.locator('.phrase-board .tile')).toHaveCount(26);
    await expect(page.locator('.phrase-board .phrase-punctuation')).toHaveText(
      "'",
    );
    await input.fill('A leopard cant change its spots');
    await input.press('Enter');
    await expect(
      page.getByRole('heading', { name: 'A win for both of you.' }),
    ).toBeVisible();
    expect((await snapshot()).match.answer).toBe(
      "A LEOPARD CAN'T CHANGE ITS SPOTS",
    );
    await page.goto(wordsUrl);
    await expect(
      page.getByRole('link', { name: 'Letterlane Words', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    const words = await snapshot();
    expect(words.game).toBe('words');
    expect(words.players[0].count).toBe(0);
    expect(words.match).not.toHaveProperty('phraseTemplate');
    expect(
      await page.evaluate(() => [
        localStorage.getItem('letterlane-name'),
        localStorage.getItem('letterlane-phrases-name'),
      ]),
    ).toEqual(['Word Player', 'Phrase Player']);
    expect(errors).toEqual([]);
  } finally {
    await friendContext.close();
  }
});

test('phrase navigation fits a tablet', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto('/phrases');
  await expect(
    page.getByRole('link', { name: 'Letterlane Phrases', exact: true }),
  ).toHaveAttribute('aria-current', 'page');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('link', { name: 'Letterlane Words', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Two minds. One word.' }),
  ).toBeVisible();
});

test('seven-word phrases and long words stay grouped on phone, tablet and desktop', async ({
  page,
}, testInfo) => {
  await page.goto('/phrases');
  await page.getByLabel('What should we call you?').fill('Layout Player');
  await page.getByRole('button', { name: 'Create a private room' }).click();
  await expect(page).toHaveURL(/\/room\//);
  const endpoint = `/api/rooms/${page.url().split('/').at(-1)}`;
  const room = (await (await page.request.get(endpoint)).json()) as RoomView;
  // Only this layout test supplies a public snapshot fixture. Gameplay above
  // exercises the real API, dictionary, scoring and persistence end to end.
  room.match.phase = 'active';
  room.match.startsAt = Date.now();
  room.players[0].ready = true;
  room.players[0].timerEndsAt = Date.now() + 180_000;
  await page.route(`**${endpoint}`, (route) =>
    route.fulfill({ json: { ...room, serverTime: Date.now() } }),
  );
  for (const [name, template] of [
    ['seven-words', '_ _______ __ _____ _ ________ _____'],
    ['long-words', Array(7).fill('_______________,').join(' ')],
  ]) {
    room.match.phraseTemplate = template;
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.reload();
      await expect(page.locator('.phrase-board .phrase-word')).toHaveCount(7);
      expect(
        await page.locator('.phrase-board').evaluate((board) => {
          const bounds = board.getBoundingClientRect();
          const words = [...board.querySelectorAll('.phrase-word')];
          return (
            document.documentElement.scrollWidth <= innerWidth &&
            new Set(words.map((word) => word.getBoundingClientRect().top))
              .size > 1 &&
            words.every((word) => {
              const box = word.getBoundingClientRect();
              const tiles = [...word.querySelectorAll('.tile')];
              const tileTop = tiles[0].getBoundingClientRect().top;
              return (
                box.left >= bounds.left &&
                box.right <= bounds.right &&
                tiles.every((tile) => {
                  const rect = tile.getBoundingClientRect();
                  return rect.width >= 12 && Math.abs(rect.top - tileTop) < 2;
                })
              );
            })
          );
        }),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${width}.png`),
        fullPage: true,
      });
    }
  }
});
