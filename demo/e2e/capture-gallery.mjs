import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Run only against a verified local build. These are authentic application captures.
const base = process.env.EIQ_BASE_URL || 'http://127.0.0.1:4173/enterprise-iq/';
const destination = '../docs/images/demo';
await mkdir(destination, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
async function visit(route) {
  await page.goto(`${base}#${route}`);
  await page.getByRole('heading', { level: 1 }).waitFor();
}
async function capture(name) {
  await page.screenshot({ path: `${destination}/${name}.png`, fullPage: true, animations: 'disabled' });
}

await visit('/home');
await capture('home');
await visit('/reports/finance-report');
await capture('report');
await visit('/data-explorer?template=revenue-reconciliation');
await page.getByRole('button', { name: 'Run query', exact: true }).click();
await page.getByRole('button', { name: 'View results', exact: true }).click();
await capture('data-explorer-results');
await visit('/ask-iq');
await page.getByRole('button', { name: 'Explain gross vs. net revenue', exact: true }).click();
await page.getByRole('region', { name: 'Guided answer' }).waitFor();
await capture('ask-iq-answer');
await visit('/settings');
await page.screenshot({ path: `${destination}/experience-settings.png`, fullPage: false, animations: 'disabled' });
await page.getByRole('textbox', { name: /^Workspace title/ }).fill('Finance close workspace');
await page.getByRole('button', { name: 'Save draft', exact: true }).click();
await page.getByRole('button', { name: 'Preview draft', exact: true }).click();
await page.getByRole('region', { name: 'Draft experience preview' }).screenshot({ path: `${destination}/experience-preview.png`, animations: 'disabled' });
await visit('/analytics');
await page.getByRole('button', { name: 'Journeys', exact: true }).click();
await capture('usage-journeys');
await page.setViewportSize({ width: 390, height: 844 });
await visit('/reports/finance-report');
await capture('mobile-report');
await browser.close();
console.log('Captured 8 authentic gallery states at 1440px and 390px.');
