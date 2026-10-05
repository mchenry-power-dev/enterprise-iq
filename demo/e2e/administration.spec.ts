import { test, expect, type Page } from '@playwright/test';

const visit = (page: Page, route: string) => page.goto(`./#${route}`);

async function chooseAdmin(page: Page) {
  const persona = page.getByRole('button', { name: 'Demo persona', exact: true });
  if (await persona.isVisible()) await persona.click();
  else {
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByText('Demo administration', { exact: true }).click();
    await page.getByRole('button', { name: 'Change demo persona', exact: true }).click();
  }
  await page.getByRole('combobox', { name: 'Demo persona role', exact: true }).selectOption('admin');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
}

test('configuration draft, preview, publish, reload, and restore alter the actual workspace', async ({ page }) => {
  await visit(page, '/home');
  await chooseAdmin(page);
  await visit(page, '/settings');
  await page.getByRole('combobox', { name: 'Configuration scope', exact: true }).selectOption('finance');
  await page.getByRole('textbox', { name: /^Workspace title/ }).fill('Finance review — Δ');
  await page.getByRole('combobox', { name: /^Theme/ }).selectOption('teal');
  await page.getByRole('button', { name: 'Move Reports down', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publish to demo', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.getByRole('button', { name: 'Preview draft', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Draft experience preview' })).toContainText('Finance review — Δ');
  await page.getByRole('button', { name: 'View active experience', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finance workspace', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Finance review — Δ', exact: true })).toHaveCount(0);
  await visit(page, '/settings');
  await page.getByRole('button', { name: 'Publish to demo', exact: true }).click();
  await page.getByRole('button', { name: 'View active experience', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finance review — Δ', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Finance review — Δ', exact: true })).toBeVisible();
  await expect(page.locator('.app')).toHaveClass(/theme-teal/);
  await visit(page, '/settings');
  await page.getByRole('button', { name: 'Restore finance-v1', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('restored as a new published version');
  await page.getByRole('button', { name: 'View active experience', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finance workspace', exact: true })).toBeVisible();
});

test('personal preferences respect organization locks and unsaved edits are guarded', async ({ page }) => {
  await visit(page, '/settings');
  await page.getByRole('combobox', { name: 'Configuration scope', exact: true }).selectOption('organization');
  await page.getByRole('textbox', { name: /^Workspace title/ }).fill('Organization title');
  await page.getByLabel('Lock Workspace title', { exact: true }).check();
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.getByRole('button', { name: 'Publish to demo', exact: true }).click();
  await page.getByRole('combobox', { name: 'Configuration scope', exact: true }).selectOption('personal');
  await expect(page.getByRole('textbox', { name: /^Workspace title/ })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: /^Workspace title/ })).toHaveValue('Organization title');
  await page.getByRole('combobox', { name: /^Theme/ }).selectOption('plum');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'View active experience', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Experience Settings');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await page.getByRole('button', { name: 'Publish to demo', exact: true }).click();
  await page.getByRole('button', { name: 'View active experience', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Organization title', exact: true })).toBeVisible();
  await expect(page.locator('.app')).toHaveClass(/theme-plum/);
});

test('synthetic analytics filters and opt-in local recording stay separate and send no analytics', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await visit(page, '/analytics');
  await expect(page.getByRole('heading', { name: 'Usage Analytics', exact: true })).toBeVisible();
  const observed = page.locator('.metric').filter({ hasText: 'Observed events' }).locator('strong');
  const allCount = Number(await observed.textContent());
  expect(allCount).toBeGreaterThan(0);
  await page.getByRole('combobox', { name: 'Source', exact: true }).selectOption('power-bi');
  const sourceCount = Number(await observed.textContent());
  expect(sourceCount).toBeGreaterThan(0);
  expect(sourceCount).toBeLessThan(allCount);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(observed).toHaveText(String(allCount));
  await page.getByRole('button', { name: 'This browser session', exact: true }).click();
  await expect(observed).toHaveText('0');
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await visit(page, '/reports/revenue-definition');
  await expect(page.getByRole('heading', { name: 'Report unavailable', exact: true })).toBeVisible();
  const unavailable = await page.evaluate(() => JSON.parse(localStorage.getItem('enterprise-iq:demo:v2')!));
  expect(unavailable.telemetry.events.filter((event: { event_name: string }) => event.event_name.startsWith('report_'))).toEqual([]);
  expect(unavailable.recent.filter((item: { id: string }) => item.id === 'revenue-definition')).toEqual([]);
  await visit(page, '/analytics');
  await page.getByRole('button', { name: /This browser session/ }).click();
  await page.getByRole('button', { name: 'Begin investigation', exact: true }).click();
  await page.getByRole('link', { name: 'Read the metric definition', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gross vs. net revenue');
  await visit(page, '/analytics');
  await page.getByRole('button', { name: /This browser session/ }).click();
  await page.getByRole('button', { name: 'Journeys', exact: true }).click();
  await expect(page.locator('.journey-summary').first()).toContainText('Report opened');
  await expect(page.locator('.journey-summary').first()).toContainText('Definition viewed');
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await page.getByRole('button', { name: 'Delete recording', exact: true }).click();
  await expect(page.getByText('No paths match the selected filters.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sample journeys', exact: true }).click();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(observed).toHaveText(String(allCount));
  const origin = new URL(page.url()).origin;
  expect(requests.filter(url => /^https?:/.test(url) && new URL(url).origin !== origin)).toEqual([]);
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('enterprise-iq:demo:v2')!));
  expect(state.telemetry.recording).toBe(false);
  expect(state.telemetry.events).toEqual([]);
});
