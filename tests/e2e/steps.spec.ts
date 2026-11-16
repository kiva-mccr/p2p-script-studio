import { expect, test, type Page } from '@playwright/test';
import { readFile, setUp } from './folder';

// Ctrl+Z and Ctrl+Y undo and redo every change to the script in Write, in order (lib/steps.ts).
const SCRIPT = 'Episode 03/script.md';
const text = `---
title: How Plants Eat
status: draft
authors: [Sam]
---

# Glucose basics

## 1 <!-- id: aaaa1 -->
Dialogue:
Every leaf makes glucose.

On screen:
The word GLUCOSE fades in.

Files:

## 2 <!-- id: bbbb2 -->
Dialogue:
Glucose is the plant's food.

On screen:
A stem.

Files:
`;

async function open(page: Page) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: text });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

test('Replace all is one step: Ctrl+Z from the find bar puts it back, Ctrl+Y does it again, and it is saved', async ({ page }) => {
  await open(page);
  await page.getByLabel('Dialogue, row 1').click();
  await page.keyboard.press('Control+f');
  await page.getByLabel('Find', { exact: true }).fill('glucose');
  const replaceWith = page.getByLabel('Replace with');
  await replaceWith.fill('sugar');
  await page.getByRole('button', { name: 'Replace all' }).click();
  await expect(page.getByLabel('Dialogue, row 2')).toHaveValue("Sugar is the plant's food.");
  await expect(page.getByLabel('Section title')).toHaveValue('Sugar basics');
  // From the Replace with box: the script goes back, not the box's words.
  await replaceWith.press('Control+z');
  await expect(replaceWith).toHaveValue('sugar');
  await expect(page.getByLabel('Section title')).toHaveValue('Glucose basics');
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf makes glucose.');
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('The word GLUCOSE fades in.');
  await expect(page.getByLabel('Dialogue, row 2')).toHaveValue("Glucose is the plant's food.");
  // The Undo toast went with it: pressing it now would put back the wrong thing.
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
  await expect.poll(() => readFile(page, SCRIPT)).toContain("Glucose is the plant's food.");
  await replaceWith.press('Control+y');
  await expect(page.getByLabel('Dialogue, row 2')).toHaveValue("Sugar is the plant's food.");
  await expect.poll(() => readFile(page, SCRIPT)).toContain("Sugar is the plant's food.");
  // Replace one is a step too.
  await page.getByLabel('Find', { exact: true }).fill('leaf');
  await replaceWith.fill('plant');
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every plant makes sugar.');
  await page.keyboard.press('Control+z');
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf makes sugar.');
});

test('typing, a move and a delete go back in order with Ctrl+Z, and come again with Ctrl+Shift+Z', async ({ page }) => {
  await open(page);
  const one = page.getByLabel('Dialogue, row 1');
  await one.click();
  await one.press('End');
  await page.keyboard.type(' Then more', { delay: 20 }); // one step: typing on in the same box
  await expect(one).toHaveValue('Every leaf makes glucose. Then more');
  await page.getByRole('button', { name: 'Move row 1 down' }).click();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue("Glucose is the plant's food.");
  await page.getByRole('button', { name: 'Delete row 1' }).click();
  await expect(page.getByLabel('Dialogue, row 2')).toHaveCount(0);
  await page.keyboard.press('Control+z'); // the delete
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue("Glucose is the plant's food.");
  await expect(page.getByLabel('Dialogue, row 2')).toHaveValue('Every leaf makes glucose. Then more');
  await page.keyboard.press('Control+z'); // the move
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf makes glucose. Then more');
  await page.keyboard.press('Control+z'); // the typing, with the cursor put where it was
  const back = page.getByLabel('Dialogue, row 1');
  await expect(back).toHaveValue('Every leaf makes glucose.');
  await expect(back).toBeFocused();
  await page.keyboard.press('Control+Shift+z');
  await expect(back).toHaveValue('Every leaf makes glucose. Then more');
  expect(await back.evaluate((box: HTMLTextAreaElement) => box.selectionStart)).toBe('Every leaf makes glucose. Then more'.length);
  await expect.poll(() => readFile(page, SCRIPT)).toContain('Every leaf makes glucose. Then more');
});

test("a flag's note keeps the browser's own Ctrl+Z", async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Flag row 1' }).click();
  const note = page.locator('[data-row="aaaa1"] .flag-note input');
  await expect(note).toBeFocused();
  await page.keyboard.type('check');
  await page.keyboard.press('Control+z');
  await expect(note).toHaveValue('');
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf makes glucose.');
});
