import { test, expect } from '@playwright/test';

test('mobile lab performance profile', async ({ page, context, browserName }, testInfo) => {
  test.skip(browserName !== 'chromium' || testInfo.project.name !== 'chromium-mobile', 'A single declared Chromium mobile lab profile.');
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', {
    offline: false, latency: 150,
    downloadThroughput: 1.6 * 1024 * 1024 / 8,
    uploadThroughput: 750 * 1024 / 8,
  });
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(() => {
    const metrics = { lcp_ms: 0, cls: 0 };
    (window as typeof window & { labMetrics: typeof metrics }).labMetrics = metrics;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) metrics.lcp_ms = entry.startTime;
    }).observe({ type: 'largest-contentful-paint', buffered: true });
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as (PerformanceEntry & { hadRecentInput: boolean; value: number })[]) {
        if (!entry.hadRecentInput) metrics.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('./#/home');
  await expect(page.getByRole('main')).toBeVisible();
  await page.waitForLoadState('networkidle');
  const measured = await page.evaluate(() => ({
    ...(window as typeof window & { labMetrics: { lcp_ms: number; cls: number } }).labMetrics,
    transferred_bytes: performance.getEntriesByType('resource').reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).transferSize, 0),
    navigation_ms: (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).domContentLoadedEventEnd,
  }));
  await testInfo.attach('mobile-lab.json', { body: JSON.stringify({
    profile: 'Playwright Pixel 7; Chromium; 4x CPU; 1.6 Mbps down; 750 Kbps up; 150 ms latency; cold browser context',
    url: new URL(page.url()).origin,
    ...measured,
    interpretation: 'Single local lab observation, not real-user or physical-device performance. Targets: LCP approximately 2500 ms, CLS below 0.1.',
  }, null, 2), contentType: 'application/json' });
});
