import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// The public pages AdSense reviews: content, navigation and crawler files.
const pages = [
  { path: '/', heading: /Two minds/ },
  { path: '/phrases', heading: /Two minds/ },
  { path: '/how-to-play', heading: 'How to play LetterLane' },
  { path: '/about', heading: 'A little friendly wordplay, for two' },
  { path: '/faq', heading: 'Frequently asked questions' },
  { path: '/privacy', heading: 'Privacy' },
];
const footerLinks = ['How to play', 'About', 'FAQ', 'Privacy'];

test.describe('public site pages', () => {
  test.skip(
    ({ isMobile }) => isMobile,
    'The desktop run also checks every page at phone width.',
  );

  for (const { path, heading } of pages) {
    test(`${path} has content, navigation and the AdSense tag`, async ({
      page,
      request,
    }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(
        page.getByRole('heading', { level: 1, name: heading }),
      ).toBeVisible();
      const footer = page.locator('footer');
      for (const name of footerLinks)
        await expect(
          footer.getByRole('link', { name, exact: true }),
        ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Letterlane Words' }),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Letterlane Phrases' }),
      ).toBeVisible();
      await expect(
        page.locator(
          'head script[src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6747177342720865"]',
        ),
      ).toHaveCount(1);
      expect(await page.locator('meta[name="robots"]').count()).toBe(0);
      // Every internal link resolves: no broken pages.
      const hrefs = await page
        .locator('a[href^="/"]')
        .evaluateAll((links) => [
          ...new Set(links.map((link) => link.getAttribute('href')!)),
        ]);
      for (const href of hrefs)
        expect((await request.get(href)).status(), href).toBe(200);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .exclude('ins.adsbygoogle')
            .analyze()
        ).violations,
      ).toEqual([]);
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    });
  }

  test('content pages carry substantive original text', async ({ page }) => {
    for (const path of ['/how-to-play', '/about', '/faq']) {
      await page.goto(path);
      const words = (await page.locator('main').innerText()).split(/\s+/);
      expect(words.length, path).toBeGreaterThan(400);
    }
  });

  test('crawler files declare the seller, sitemap and private rooms', async ({
    request,
    baseURL,
  }) => {
    const ads = await request.get('/ads.txt');
    expect(ads.status()).toBe(200);
    expect(ads.headers()['content-type']).toContain('text/plain');
    expect(await ads.text()).toBe(
      'google.com, pub-6747177342720865, DIRECT, f08c47fec0942fa0\n',
    );
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /room/');
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toMatch(/User-Agent: Mediapartners-Google\nAllow: \//);
    expect(robots).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
    const sitemap = await (await request.get('/sitemap.xml')).text();
    for (const path of ['', ...pages.slice(1).map((p) => p.path)])
      expect(sitemap).toContain(`<loc>${baseURL}${path}</loc>`);
    expect(sitemap).not.toContain('/room/');
  });

  test('room invitations stay out of search, and unknown pages 404', async ({
    page,
  }) => {
    await page.goto('/room/ABCDEF');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex, nofollow',
    );
    const missing = await page.goto('/no-such-page');
    expect(missing?.status()).toBe(404);
    await expect(
      page.getByRole('link', { name: 'Back to LetterLane' }),
    ).toBeVisible();
  });
});
