import { expect, test } from './base';
import { listFiles, readFile, setUp } from './folder';

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#4a4"/></svg>';
const row = (files: string[]) => `## 1 <!-- id: aaaaa -->\nDialogue:\nHello.\n\nOn screen:\n\nFiles:\n${files.map((f) => `- ${f}\n`).join('')}`;
const FILES = {
  'Trailer/script.md': `---\ntitle: Trailer\n---\n\n${row(['assets/leaf.svg'])}`,
  'Trailer/assets/leaf.svg': 'old leaf',
  'Water Cycle/script.md': `---\ntitle: The Water Cycle\nstatus: approved\n---\n\n${row(['assets/leaf.svg', '[Rain sound](https://example.com/rain.mp3)'])}`,
  'Water Cycle/assets/leaf.svg': SVG,
  'Water Cycle/assets/cloud.mp4': 'mp4',
  'Empty/script.md': `---\ntitle: Empty\n---\n\n${row([])}`,
};

async function openBrowser(page: import('@playwright/test').Page) {
  await setUp(page, '#/Trailer', FILES);
  await page.getByLabel('Dialogue, row 1').hover();
  await page.getByRole('button', { name: '+ Add', exact: true }).click();
  await page.getByRole('button', { name: 'Reuse a file…' }).click();
  return page.getByRole('dialog', { name: 'Reuse a file' });
}

test('Reuse a file lists this script\'s files first, then every other script with files, and copies a picked file in', async ({ page }) => {
  const box = await openBrowser(page);
  await expect(box.locator('.sum')).toHaveText('4 files in 2 scripts');
  await expect(box.locator('h3')).toHaveText(['In this script', 'The Water Cycle · Approved']); // not one with no files
  await expect(box.locator('.tile .name')).toHaveText(['leaf.svg', 'cloud.mp4', 'leaf.svg', 'Rain sound']);
  await expect(box.locator('.tile .uses')).toHaveText(['Row 1', 'Not in any row', 'In 1 row', 'In 1 row']);
  await expect(box.locator('.tile img:visible')).toHaveCount(1);
  await expect(box.getByRole('button', { name: 'Add to row 1' })).toBeDisabled();
  await box.getByRole('region', { name: 'The Water Cycle' }).getByRole('button', { name: /leaf\.svg/ }).click();
  await expect(box.locator('.foot')).toContainText("leaf.svg will be copied into this script's assets folder.");
  await box.getByRole('button', { name: 'Add to row 1' }).click();
  await expect(box).toHaveCount(0);
  // This script already has a leaf.svg: the copy gets a number, and nothing is overwritten.
  await expect(page.locator('.chip').getByRole('button', { name: 'leaf 2.svg', exact: true })).toBeVisible();
  await expect(page.getByText('Copied from The Water Cycle')).toBeVisible();
  expect(await readFile(page, 'Trailer/assets/leaf 2.svg')).toBe(SVG);
  expect(await readFile(page, 'Trailer/assets/leaf.svg')).toBe('old leaf');
  await expect.poll(() => readFile(page, 'Trailer/script.md')).toContain('- assets/leaf 2.svg');
});

test('a file of this script is reused as the same file, not copied', async ({ page }) => {
  const box = await openBrowser(page);
  await box.getByRole('region', { name: 'In this script' }).getByRole('button', { name: /leaf\.svg/ }).click();
  await expect(box.locator('.foot')).toContainText('leaf.svg is already in this script: the row uses the same file.');
  await box.getByRole('button', { name: 'Add to row 1' }).click();
  await expect(box).toHaveCount(0);
  await expect(page.locator('.chip').getByRole('button', { name: 'leaf.svg', exact: true })).toHaveCount(2);
  await expect(page.getByText(/Copied from/)).toHaveCount(0);
  await expect.poll(async () => (await readFile(page, 'Trailer/script.md')).match(/- assets\/leaf\.svg/g)?.length).toBe(2);
  expect(await listFiles(page, 'Trailer/assets')).toEqual(['leaf.svg']);
});

test('files dropped on a row are copied in; while dragging, every row is outlined and the one under the pointer is solid', async ({ page }) => {
  const two = `## 1 <!-- id: aaaaa -->\nDialogue:\nHello.\n\nOn screen:\n\nFiles:\n\n## 2 <!-- id: bbbbb -->\nDialogue:\nBye.\n\nOn screen:\n\nFiles:\n`;
  await setUp(page, '#/Trailer', { 'Trailer/script.md': `---\ntitle: Trailer\n---\n\n${two}` });
  const first = page.getByRole('group', { name: 'Images and files, row 1' });
  const second = page.getByRole('group', { name: 'Images and files, row 2' });
  await expect(first).not.toHaveClass(/target/);
  // A real drag sends dragover again and again while the pointer is over the cell.
  await first.evaluate((cell) => {
    const data = new DataTransfer();
    data.items.add(new File(['sun'], 'sun.txt', { type: 'text/plain' }));
    const over = () => cell.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: data }));
    over();
    const every = setInterval(over, 50);
    (window as unknown as { dropIt: () => void }).dropIt = () => {
      clearInterval(every);
      cell.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
    };
  });
  await expect(first).toHaveClass(/over/);
  await expect(first.getByText('Drop to add to row 1')).toBeVisible();
  await expect(second).toHaveClass(/target/);
  await expect(second).not.toHaveClass(/over/);
  await page.evaluate(() => (window as unknown as { dropIt: () => void }).dropIt());
  await expect(first.locator('.chip').getByRole('button', { name: 'sun.txt', exact: true })).toBeVisible();
  await expect(second).not.toHaveClass(/target/);
  await expect(first.getByText('Drop to add to row 1')).toHaveCount(0);
  expect(await readFile(page, 'Trailer/assets/sun.txt')).toBe('sun');
  await expect.poll(() => readFile(page, 'Trailer/script.md')).toContain('- assets/sun.txt');
});

test('a link is added as the same link, and Find narrows by name', async ({ page }) => {
  const box = await openBrowser(page);
  await box.getByLabel('Find').fill('rain');
  await expect(box.locator('.tile .name')).toHaveText(['Rain sound']);
  await box.getByRole('button', { name: /Rain sound/ }).click();
  await expect(box.locator('.foot')).toContainText('Rain sound is a link: it is added as the same link.');
  await box.getByRole('button', { name: 'Add to row 1' }).click();
  await expect(page.getByRole('link', { name: 'Rain sound' })).toBeVisible();
  await expect.poll(() => readFile(page, 'Trailer/script.md')).toContain('- [Rain sound](https://example.com/rain.mp3)');
});

test('Find with no match says so, and Esc closes the window', async ({ page }) => {
  const box = await openBrowser(page);
  await box.getByLabel('Find').fill('zebra');
  await expect(box).toContainText('No file has "zebra" in its name.');
  await page.keyboard.press('Escape');
  await expect(box).toHaveCount(0);
});

test('Files on the script list shows every script\'s files, opens a file, and a script\'s name opens it', async ({ page }) => {
  await setUp(page, '', FILES);
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  const box = page.getByRole('dialog', { name: 'Files in every script' });
  await expect(box.locator('h3')).toHaveText(['The Water Cycle · Approved', 'Trailer · Draft']);
  await expect(box.getByRole('button', { name: /Add to row/ })).toHaveCount(0);
  const popup = page.waitForEvent('popup');
  await box.getByRole('button', { name: /cloud\.mp4/ }).click();
  expect((await popup).url()).toMatch(/^blob:/);
  await box.getByRole('link', { name: 'Trailer' }).click();
  await expect(box).toHaveCount(0);
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Hello.');
});
