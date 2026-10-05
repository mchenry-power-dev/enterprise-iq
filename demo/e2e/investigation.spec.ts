import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const visit = (page: Page, route: string) => page.goto(`./#${route}`);
const select = (page: Page, name: string) => page.getByRole('combobox', { name, exact: true });
async function viewResults(page: Page) {
  await page.getByRole('button', { name: 'Run query', exact: true }).click();
  await page.getByRole('button', { name: 'View results', exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
}

test('connected investigation preserves scope and reconciles before saving', async ({ page }) => {
  await visit(page, '/reports/finance-report');
  await page.getByRole('link', { name: 'Read the metric definition', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gross vs. net revenue');
  await expect(page.getByLabel('Investigation context')).toContainText('September 2026');
  await expect(page.getByLabel('Investigation context')).toContainText('Aster Manufacturing US');
  await page.getByRole('link', { name: 'Inspect credits query', exact: true }).click();
  await expect(select(page, 'Query template')).toHaveValue('credits-by-period');
  await expect(select(page, 'Reporting period')).toHaveValue('2026-09');
  await viewResults(page);
  await expect(page.getByText('48 rows · Page 1 of 6', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByText('48 rows · Page 2 of 6', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Read the close note', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('September close note');
  await page.getByRole('button', { name: 'Explain with Ask IQ', exact: true }).click();
  await page.getByRole('button', { name: 'Explain gross vs. net revenue', exact: true }).click();
  const answer = page.getByRole('region', { name: 'Guided answer' });
  await expect(answer).toContainText('$2,000,000');
  await expect(answer).toContainText('$160,000');
  await expect(answer).toContainText('$1,840,000');
  await expect(answer).toContainText('September 2026');
  await expect(answer.getByRole('button', { name: /Gross.*net.*revenue/ })).toBeVisible();
  await page.getByRole('button', { name: 'Save investigation', exact: true }).click();
  await visit(page, '/my-workspace');
  await expect(page.getByRole('heading', { name: 'Revenue investigation · September 2026', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Revenue investigation · September 2026', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Guided answer' })).toContainText('$1,840,000');
});

test('Databricks template computes changed inputs and exports its bounded result @smoke', async ({ page }) => {
  await visit(page, '/data-explorer');
  await select(page, 'Source').selectOption('Databricks');
  await select(page, 'Query template').selectOption('sales-by-region');
  await select(page, 'Region').selectOption('West');
  await page.getByRole('button', { name: 'Show SQL preview', exact: true }).click();
  await expect(page.getByLabel('SQL preview')).toContainText("region = 'West'");
  await viewResults(page);
  await expect(page.getByRole('cell', { name: '$360,000', exact: true })).toBeVisible();
  await select(page, 'Reporting period').selectOption('2026-08');
  await expect(page.getByRole('status').filter({ hasText: 'Parameters changed' })).toBeVisible();
  await expect(page.getByLabel('SQL preview')).toContainText("period = '2026-08'");
  await viewResults(page);
  await expect(page.getByRole('cell', { name: '$334,800', exact: true })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export results', exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/sales-by-region.*2026-08.*West.*complete/i);
  const csv = await readFile((await file.path())!, 'utf8');
  expect(csv).toContain('West');
  expect(csv).toContain('33480000');
  expect(csv).not.toContain('Northeast');
});

test('partial, empty, failed, and cancelled queries remain distinct', async ({ page }) => {
  await visit(page, '/data-explorer?template=credits-by-period');
  await page.getByRole('button', { name: 'Sample conditions & limits', exact: true }).click();
  for (const invalid of ['0', '', '1.5']) {
    await page.getByRole('spinbutton', { name: 'Row limit', exact: true }).fill(invalid);
    await page.getByRole('button', { name: 'Save query', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Row limit must be a whole number from 1 to 100.');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('enterprise-iq:demo:v2') || '{"saved":[]}').saved)).toEqual([]);
    await page.getByRole('button', { name: 'Run query', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveText('Row limit must be a whole number from 1 to 100.');
  }
  await page.getByRole('spinbutton', { name: 'Row limit', exact: true }).fill('3');
  await viewResults(page);
  await expect(page.getByText('Partial result', { exact: true })).toBeVisible();
  await expect(page.getByText('3 rows · Page 1 of 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Save query', exact: true }).click();
  await visit(page, '/my-workspace');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Data Explorer');
  await expect(page.getByRole('complementary', { name: 'Browser storage status', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sample conditions & limits', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Row limit', exact: true })).toHaveValue('3');
  await page.getByRole('spinbutton', { name: 'Row limit', exact: true }).fill('100');
  await select(page, 'Sample condition').selectOption('empty');
  await viewResults(page);
  await expect(page.getByText('Complete result', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No matching records', exact: true })).toBeVisible();
  await select(page, 'Sample condition').selectOption('failed');
  await page.getByRole('button', { name: 'Run query', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('did not return a result');
  await select(page, 'Sample condition').selectOption('complete');
  // Hold the app's next-frame polling to exercise a still-running local query deterministically.
  await page.evaluate(() => {
    const state = window as any;
    state.acceptanceRaf = window.requestAnimationFrame;
    state.acceptanceFrames = [];
    window.requestAnimationFrame = callback => state.acceptanceFrames.push(callback);
  });
  await page.getByRole('button', { name: 'Run query', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Query cancelled');
  await page.evaluate(() => {
    const state = window as any;
    window.requestAnimationFrame = state.acceptanceRaf;
    state.acceptanceFrames.forEach((callback: FrameRequestCallback) => callback(performance.now()));
  });
  await viewResults(page);
  await expect(page.getByText('48 rows · Page 1 of 6', { exact: true })).toBeVisible();
});

test('guided answers change with scope, evidence, unsupported input, and persona', async ({ page }) => {
  await visit(page, '/ask-iq');
  await page.getByRole('button', { name: 'Explain gross vs. net revenue', exact: true }).click();
  const answer = page.getByRole('region', { name: 'Guided answer' });
  await expect(answer).toContainText('$1,840,000');
  await select(page, 'Region').selectOption('West');
  await expect(answer).toContainText('$330,000');
  await expect(answer).not.toContainText('$1,840,000');
  await page.getByText('Try a different evidence scenario', { exact: true }).click();
  await select(page, 'Evidence available').selectOption('missing-credits');
  await expect(page.getByLabel('Revenue calculation')).toHaveCount(0);
  await expect(answer).not.toContainText('$330,000');
  await select(page, 'Evidence available').selectOption('baseline');
  await page.getByRole('textbox', { name: 'Or enter one of the supported questions', exact: true }).fill('Predict our 2030 market price');
  await page.getByRole('button', { name: 'Ask IQ', exact: true }).click();
  await expect(answer).toContainText('supported');
  await expect(page.getByLabel('Revenue calculation')).toHaveCount(0);
  await page.getByRole('button', { name: 'Explain gross vs. net revenue', exact: true }).click();
  const persona = page.getByRole('button', { name: 'Demo persona', exact: true });
  if (await persona.isVisible()) await persona.click();
  else {
    await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
    await page.getByText('Demo administration', { exact: true }).click();
    await page.getByRole('button', { name: 'Change demo persona', exact: true }).click();
  }
  await select(page, 'Demo persona role').selectOption('restricted');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByLabel('Revenue calculation')).toHaveCount(0);
  await expect(answer).not.toContainText('September close note');
  await expect(answer).not.toContainText('$330,000');
});
