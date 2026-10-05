import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  ['home', '/home'], ['reports', '/reports'], ['report', '/reports/finance-report'],
  ['data-explorer', '/data-explorer'], ['knowledge', '/knowledge'], ['ask-iq', '/ask-iq'],
  ['my-workspace', '/my-workspace'], ['settings', '/settings'], ['analytics', '/analytics'], ['sources', '/sources'],
] as const;

test('main pages have accessible structure and authentic desktop/mobile captures', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  test.skip(testInfo.project.name !== 'chromium-desktop', 'One dedicated visual and accessibility sweep; behavior runs across engines.');
  for (const [name, route] of pages) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      await page.goto(`./#${route}`);
      await expect(page.getByRole('main')).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
      expect(audit.violations, `${name} at ${width}px: ${audit.violations.map(v => `${v.id}: ${v.nodes.map(n => n.target.join(' ')).join(', ')}`).join('\n')}`).toEqual([]);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true, animations: 'disabled' });
    }
  }
});

test('key surfaces reflow at all requested widths and enlarged text', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(testInfo.project.name !== 'chromium-desktop', 'Dedicated Chromium layout matrix; phone journeys also run in WebKit.');
  for (const width of [320, 360, 390, 430, 768, 1024, 1366, 1440, 1600]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 900 });
    for (const route of ['/home', '/reports/finance-report', '/data-explorer', '/settings', '/analytics']) {
      await page.goto(`./#${route}`);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const size = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
      expect(size.page, `${route} has page-wide overflow at ${width}px`).toBeLessThanOrEqual(size.viewport + 1);
    }
  }
  await page.setViewportSize({ width: 768, height: 1024 });
  for (const route of ['/home', '/reports/finance-report', '/settings']) {
    await page.goto(`./#${route}`);
    // Hash navigation preserves the shell; reload prevents multiplying its text again.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate(() => {
      const sizes = Array.from(document.querySelectorAll<HTMLElement>('*')).map(element => [element, Number.parseFloat(getComputedStyle(element).fontSize)] as const);
      for (const [element, size] of sizes) if (Number.isFinite(size)) element.style.fontSize = `${size * 2}px`;
    });
    const size = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: innerWidth }));
    expect(size.page, `${route} has page-wide overflow with enlarged text`).toBeLessThanOrEqual(size.viewport + 1);
    await page.screenshot({ path: testInfo.outputPath(`enlarged-${route.split('/')[1]}.png`), fullPage: true, animations: 'disabled' });
  }
});
