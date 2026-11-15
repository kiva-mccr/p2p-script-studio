import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile, setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';

async function openExample(page: Page) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

// Selects `text` in a Write cell, as a person would.
async function select(page: Page, label: string, text: string) {
  const box = page.getByLabel(label);
  await box.click();
  await box.evaluate((el: HTMLTextAreaElement, text) => {
    const at = el.value.indexOf(text);
    el.setSelectionRange(at, at + text.length);
    el.dispatchEvent(new Event('select'));
  }, text);
}

test('select text, then Bold: saved as marks, shown as bold when not typing', async ({ page }) => {
  await openExample(page);
  await select(page, 'Dialogue, row 1', 'tiny factory');
  const bar = page.getByRole('toolbar', { name: 'Formatting' });
  await bar.getByRole('button', { name: 'Bold' }).click();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf you have ever seen is running a **tiny factory**.');
  await page.keyboard.press('Control+i'); // still selected: italic on top
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf you have ever seen is running a ***tiny factory***.');
  await page.keyboard.press('Control+z'); // the browser's own undo
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf you have ever seen is running a **tiny factory**.');
  await page.getByLabel('On screen, row 1').click(); // away from the cell
  await expect(bar).toHaveCount(0);
  await expect(page.locator('strong', { hasText: 'tiny factory' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Saved');
  expect(await readFile(page, SCRIPT)).toContain('running a **tiny factory**.');
});

test('a link selects the address to type; Clear takes the marks out', async ({ page }) => {
  await openExample(page);
  await select(page, 'Dialogue, row 1', 'tiny factory');
  await page.getByRole('toolbar').getByRole('button', { name: 'Link' }).click();
  await page.keyboard.type('https://example.com/leaves');
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue(/\[tiny factory\]\(https:\/\/example\.com\/leaves\)/);
  await page.getByLabel('On screen, row 1').click();
  await expect(page.locator('a', { hasText: 'tiny factory' })).toHaveAttribute('href', 'https://example.com/leaves');
  await select(page, 'Dialogue, row 1', 'running a [tiny factory](https://example.com/leaves)');
  await page.getByRole('button', { name: 'Clear formatting' }).click();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf you have ever seen is running a tiny factory.');
});

test('an equation is shown with LaTeX, in Write and in Review', async ({ page }) => {
  await openExample(page);
  await page.getByLabel('On screen, row 4').fill('Glucose: $C_6H_{12}O_6$');
  await page.getByLabel('Dialogue, row 1').click();
  await expect(page.locator('.katex').first()).toBeVisible();
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(page.getByLabel('On screen, row 4').locator('.katex')).toBeVisible();
  await expect(page.getByLabel('On screen, row 1')).toContainText('Slow push-in');
});

test('the toolbar sits by the selected words, and below them when there is no room above (UX-7)', async ({ page }) => {
  await openExample(page);
  const box = page.getByLabel('Dialogue, row 3');
  await box.fill('Inside each cell, tiny parts called chloroplasts catch the light. They are packed with chlorophyll, the green '
    + 'that makes leaves look green. The light they catch powers the whole factory and frees the oxygen we breathe.');
  await box.evaluate((el) => scrollBy(0, el.getBoundingClientRect().top - innerHeight / 2));
  await select(page, 'Dialogue, row 3', 'the oxygen we breathe');
  const bar = page.getByRole('toolbar', { name: 'Formatting' });
  const field = (await box.boundingBox())!;
  const line = await box.evaluate((el: HTMLTextAreaElement) => parseFloat(getComputedStyle(el).lineHeight));
  let tools = (await bar.boundingBox())!;
  expect(field.height).toBeGreaterThan(line * 2.5); // three lines or more
  expect(tools.y + tools.height).toBeGreaterThan(field.y + line); // above the last line, not above the field's top
  expect(tools.y + tools.height).toBeLessThan(field.y + field.height - line + 4);

  // The field's top just under the column names: the toolbar opens below the words, all of it in the window.
  await box.evaluate((el: HTMLTextAreaElement) => el.blur()); // the toolbar goes, so the next click lands in the box
  const head = (await page.locator('.table .head').boundingBox())!;
  await box.evaluate((el, under) => scrollBy(0, el.getBoundingClientRect().top - under - 4), head.y + head.height);
  await select(page, 'Dialogue, row 3', 'Inside each cell');
  tools = (await bar.boundingBox())!;
  const now = (await box.boundingBox())!;
  expect(tools.y).toBeGreaterThan(now.y + line - 2); // under the first line
  expect(tools.y).toBeGreaterThanOrEqual(head.y + head.height);
});
