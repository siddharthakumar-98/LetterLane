import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { RoomView } from '../../src/lib/game/types';

for (const [difficulty, label, cap, nextWords] of [
  ['easy', 'Easy', 5, 4],
  ['normal', 'Normal', 7, 6],
] as const) {
  test(`${label} Phrases persists through reload, bot play and rematch`, async ({
    page,
  }, testInfo) => {
    await page.goto('/phrases');
    const picker = page.getByRole('group', {
      name: 'Phrase difficulty',
      exact: true,
    });
    await expect(
      picker.getByRole('radio', { name: 'Normal Up to 7 words' }),
    ).toBeChecked();
    await picker
      .getByRole('radio', { name: `${label} Up to ${cap} words` })
      .check();
    await expect(
      page.getByRole('group', { name: 'Word difficulty', exact: true }),
    ).toHaveCount(0);
    await page.getByLabel('What should we call you?').fill('Phrase player');
    await page
      .getByRole('group', { name: 'Bot difficulty', exact: true })
      .getByRole('radio', { name: 'Hard', exact: true })
      .check();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('phrase-difficulty.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Create a private room' }).click();
    await expect(page).toHaveURL(/\/room\//);
    const snapshot = () =>
      page.evaluate(
        async () =>
          (
            await fetch(`/api/rooms/${location.pathname.split('/').at(-1)}`)
          ).json() as Promise<RoomView>,
      );
    await expect(
      page.getByText(`YOUR PRIVATE ROOM · ${label} · up to ${cap} words`),
    ).toBeVisible();
    expect((await snapshot()).phraseDifficulty).toBe(difficulty);
    await page.reload();
    expect((await snapshot()).phraseDifficulty).toBe(difficulty);
    await page
      .getByRole('button', { name: 'How to play', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toContainText(
      `${label} phrases contain up to ${cap} words.`,
    );
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'I’m ready', exact: true }).click();
    await page
      .getByRole('button', { name: 'Play with bot', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Submit guess' }),
    ).toBeEnabled();
    await expect(page.locator('.phrase-board .phrase-word')).toHaveCount(5);
    await expect(
      page.getByRole('navigation', { name: 'Game mode' }),
    ).toHaveCount(0);
    await page.getByRole('heading', { name: 'Your lane', exact: true }).click();
    await page.keyboard.type('ZZZZZZZ');
    await expect(page.locator('.guess-feedback')).toHaveText(
      'Word 1 is not in word list',
    );
    expect((await snapshot()).players[0].count).toBe(0);
    for (let i = 0; i < 7; i++) await page.keyboard.press('Backspace');
    await page.keyboard.type('ACTIONSSPEAKLOUDERTHANWORDS');
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', { name: 'This lane is yours.' }),
    ).toBeVisible();
    expect((await snapshot()).match.answer).toBe(
      'ACTIONS SPEAK LOUDER THAN WORDS',
    );
    await page.getByRole('button', { name: 'One more round' }).click();
    await expect(
      page.getByRole('button', { name: 'Submit guess' }),
    ).toBeEnabled();
    const next = await snapshot();
    expect(next.phraseDifficulty).toBe(difficulty);
    expect(next.match.round).toBe(2);
    expect(next.match.phraseTemplate!.split(' ')).toHaveLength(nextWords);
    await expect(page.locator('.phrase-board .phrase-word')).toHaveCount(
      nextWords,
    );
    await page.reload();
    expect((await snapshot()).phraseDifficulty).toBe(difficulty);
    await expect(page.locator('.phrase-board .phrase-word')).toHaveCount(
      nextWords,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test('Words retains its length picker without Phrase difficulty', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('group', { name: 'Phrase difficulty', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('group', { name: 'Word difficulty', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('radio', { name: 'Easy 5 letters' }),
  ).toBeChecked();
});
