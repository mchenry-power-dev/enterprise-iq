import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const visit = (page: Page, route: string) => page.goto(`./#${route}`);

test('first visitor filters a report, inspects a table, and returns @smoke', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await visit(page, '/home');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your reports, data, and');
  await expect(page.getByText('Interactive demo · Sample data · Simulated sources')).toBeVisible();
  await page.getByRole('link', { name: 'Finance Performance', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Finance Performance');
  await expect(page.getByText('$1,840,000', { exact: true }).first()).toBeVisible();
  await page.getByRole('combobox', { name: 'Region', exact: true }).selectOption('West');
  await expect(page.getByText('$330,000', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Data table', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'West', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Northeast', exact: true })).toHaveCount(0);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export selected data', exact: true }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toMatch(/finance-report.*2026-09.*west.*\.csv/i);
  const csv = await readFile((await file.path())!, 'utf8');
  expect(csv).toContain('West');
  expect(csv).not.toContain('Northeast');
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await expect(page.getByText('$1,840,000', { exact: true }).first()).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your reports, data, and');
  expect(errors).toEqual([]);
});

test('Sales report has a different usable analytical page @smoke', async ({ page }) => {
  await visit(page, '/reports/sales-report');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sales Performance');
  await expect(page.getByText('Looker · Sample report', { exact: true })).toBeVisible();
  await expect(page.getByText('$2,000,000', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Channels & products', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gross revenue by channel', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Product', exact: true }).selectOption('Equipment');
  await expect(page.getByText('$1,000,000', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sales Performance');
  await expect(page.getByRole('combobox', { name: 'Product', exact: true })).toHaveValue('Equipment');
});

test('report links, native-source explanation, and unknown resources recover', async ({ page }) => {
  await visit(page, '/reports/finance-report');
  await page.getByRole('button', { name: 'Native source', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('No enterprise tenant is connected');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Native source', exact: true })).toBeFocused();
  await visit(page, '/reports/not-a-real-resource');
  await expect(page.getByRole('heading', { name: 'Report unavailable', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Return to Reports', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reports');
});

test('discovery retains search and filters through Back and Forward', async ({ page }) => {
  await visit(page, '/reports');
  await page.getByLabel('Search catalog', { exact: true }).fill('gross');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByRole('combobox', { name: 'Source', exact: true }).selectOption('Looker');
  await page.getByRole('link', { name: 'Sales Performance', exact: true }).click();
  await page.goBack();
  await expect(page.getByLabel('Search catalog', { exact: true })).toHaveValue('gross');
  await expect(page.getByRole('combobox', { name: 'Source', exact: true })).toHaveValue('Looker');
  await page.goForward();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sales Performance');
  await page.goBack();
  await page.getByLabel('Search catalog', { exact: true }).fill('不存在 Δ no-such-metric');
  await expect(page.getByRole('heading', { name: 'No matching resources', exact: true })).toBeVisible();
});

test('favorites and scoped reset survive reload without clearing another app', async ({ page }) => {
  await visit(page, '/home');
  await page.evaluate(() => localStorage.setItem('unrelated-demo:acceptance-sentinel', 'preserve'));
  await page.getByRole('button', { name: 'Favorite Finance Performance', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Unfavorite Finance Performance', exact: true })).toBeVisible();
  await visit(page, '/my-workspace');
  await page.getByRole('button', { name: /^Favorites/ }).click();
  await expect(page.getByRole('heading', { name: 'Finance Performance', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset Enterprise IQ data', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Finance Performance', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset Enterprise IQ data', exact: true }).click();
  await page.getByRole('button', { name: 'Reset demo data', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('unrelated-demo:acceptance-sentinel'))).toBe('preserve');
  await page.reload();
  await page.getByRole('button', { name: /^Favorites/ }).click();
  await expect(page.getByRole('heading', { name: 'Keep useful reports close', exact: true })).toBeVisible();
});

test('blocked browser storage retains a usable session', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', { value: () => { throw new DOMException('Blocked', 'SecurityError'); } });
    Object.defineProperty(Storage.prototype, 'setItem', { value: () => { throw new DOMException('Blocked', 'QuotaExceededError'); } });
  });
  await visit(page, '/home');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Your reports, data, and');
  await expect(page.getByLabel('Browser storage status')).toContainText('Session-only storage');
  await page.getByRole('link', { name: 'Finance Performance', exact: true }).click();
  await page.getByRole('combobox', { name: 'Region', exact: true }).selectOption('West');
  await expect(page.getByText('$330,000', { exact: true }).first()).toBeVisible();
});

test('malformed saved state is preserved until an explicit scoped recovery choice', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await visit(page, '/home');
  await page.getByRole('button', { name: 'Favorite Finance Performance', exact: true }).click();
  const preserved = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('enterprise-iq:demo:v2')!);
    state.ui = null;
    const raw = JSON.stringify(state);
    localStorage.setItem('enterprise-iq:demo:v2', raw);
    localStorage.setItem('unrelated-demo:acceptance-sentinel', 'preserve');
    return raw;
  });
  await page.reload();
  const recovery = page.getByRole('complementary', { name: 'Browser storage status', exact: true });
  await expect(recovery).toContainText('Saved-data recovery');
  expect(await page.evaluate(() => localStorage.getItem('enterprise-iq:demo:v2'))).toBe(preserved);
  await recovery.getByRole('button', { name: 'Continue in this session', exact: true }).click();
  await page.getByRole('link', { name: 'Finance Performance', exact: true }).click();
  await page.getByRole('combobox', { name: 'Region', exact: true }).selectOption('West');
  await expect(page.getByText('$330,000', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('enterprise-iq:demo:v2'))).toBe(preserved);
  await page.reload();
  await expect(recovery).toContainText('Saved-data recovery');
  await recovery.getByRole('button', { name: 'Reset Enterprise IQ data', exact: true }).click();
  await page.getByRole('button', { name: 'Reset demo data', exact: true }).click();
  await expect(recovery).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('unrelated-demo:acceptance-sentinel'))).toBe('preserve');
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Finance Performance');
  await expect(recovery).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('saved report views and renamed collections preserve the selected scope', async ({ page }) => {
  await visit(page, '/reports/finance-report');
  await page.getByRole('combobox', { name: 'Region', exact: true }).selectOption('West');
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  await page.getByRole('button', { name: 'Reset filters', exact: true }).click();
  await visit(page, '/my-workspace');
  await page.getByRole('button', { name: /^Collections/ }).click();
  await page.getByRole('textbox', { name: 'Collection name', exact: true }).fill('Close review Δ');
  await page.getByRole('button', { name: 'Create collection', exact: true }).click();
  const collection = page.locator('.collection-row').filter({ hasText: 'Close review Δ' });
  await collection.getByRole('button', { name: 'Rename', exact: true }).click();
  await page.getByRole('textbox', { name: 'Rename collection', exact: true }).fill('September review Δ');
  await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await page.getByRole('combobox', { name: 'Move to collection', exact: true }).selectOption({ label: 'September review Δ' });
  await page.reload();
  await page.getByRole('combobox', { name: 'Collection', exact: true }).selectOption({ label: 'September review Δ' });
  await expect(page.getByRole('heading', { name: 'Finance Performance · September 2026', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Region', exact: true })).toHaveValue('West');
  await expect(page.getByText('$330,000', { exact: true }).first()).toBeVisible();
});
