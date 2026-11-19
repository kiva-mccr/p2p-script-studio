import { expect, test, type Page } from './base';
import { readFileSync } from 'node:fs';
import { readFile, setUp, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#4a4"/></svg>';
// All but two of the example's files are in the folder: storyboard-p4.pdf and glucose-model.png are missing.
const OTHERS = ['leaf-push-in.mp4', 'music-bed.mp3', 'cell-micrograph.tif', 'glucose-notes.docx', 'park-shot-list.txt', 'lesson-slides.pptx'];
const FILES = { 'Episode 03/script.md': example, 'Episode 03/assets/leaf-closeup.jpg': 'jpg', 'Episode 03/assets/icons-ingredients.svg': SVG,
  ...Object.fromEntries(OTHERS.map((f) => [`Episode 03/assets/${f}`, 'x'])) };

async function openAssets(page: Page) {
  await setUp(page, '#/Episode%2003', FILES);
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.getByRole('button', { name: /^Assets/ }).click();
  return page.getByRole('region', { name: 'Assets' });
}

test('the Assets tab counts what is missing and lists it first, then what to find, then the rest', async ({ page }) => {
  await setUp(page, '#/Episode%2003', FILES);
  await expect(page.getByRole('button', { name: /^Assets/ })).toContainText('2');
  await expect(page.getByLabel('2 missing')).toBeVisible();
  await page.getByRole('button', { name: /^Assets/ }).click();
  const assets = page.getByRole('region', { name: 'Assets' });
  await expect(assets.locator('.sum')).toHaveText('12 in 5 rows · 2 missing · 1 to find');
  await expect(assets.locator('h2')).toHaveText(['Missing from the folder', 'Still to find or film', 'In the folder or linked']);
  await expect(assets.locator('li.lost .open')).toHaveText(['storyboard-p4.pdf', 'glucose-model.png']);
  await expect(assets.locator('li.find')).toContainText('Park b-roll of a deep breath (to film)');
  await expect(assets.locator('li.here .open')).toHaveText(['leaf-closeup.jpg', 'leaf-push-in.mp4', 'icons-ingredients.svg', 'music-bed.mp3',
    'Chloroplast zoom animation', 'cell-micrograph.tif', 'glucose-notes.docx', 'park-shot-list.txt', 'lesson-slides.pptx']);
  await expect(assets.locator('li.here img:visible')).toHaveCount(1); // the svg; the fake files aren't pictures, so no thumbnail is drawn
});

test('each file in the folder or linked shows the words of its row, between its name and its row number', async ({ page }) => {
  const assets = await openAssets(page);
  const leaf = assets.locator('li.here').filter({ hasText: 'leaf-closeup.jpg' });
  await expect(leaf.locator('.excerpt')).toHaveText('Every leaf you have ever seen is running a tiny factory.');
  const [name, words, rows] = await Promise.all(['.name', '.excerpt', '.rows'].map((s) => leaf.locator(s).boundingBox()));
  expect(name!.x + name!.width).toBeLessThanOrEqual(words!.x);
  expect(words!.x + words!.width).toBeLessThanOrEqual(rows!.x);
  await expect(assets.locator('li.lost .excerpt, li.find .excerpt')).toHaveCount(0);
});

test('a file put in the folder stops being missing', async ({ page }) => {
  const assets = await openAssets(page);
  await expect(assets.locator('li.lost')).toHaveCount(2);
  await writeFile(page, 'Episode 03/assets/glucose-model.png', 'png');
  await expect(assets.locator('li.lost')).toHaveCount(1, { timeout: 10000 }); // the 5 s check
  await expect(page.getByLabel('1 missing')).toBeVisible();
});

test('Order by row lists each row under its section, and is remembered', async ({ page }) => {
  const assets = await openAssets(page);
  await assets.getByRole('button', { name: 'Order: by what needs doing' }).click();
  await expect(assets.locator('h2')).toHaveText(['Intro', 'Inside the leaf', 'Wrap-up']);
  await expect(assets.locator('.by-row').nth(3)).toContainText('glucose-model.png · missing');
  await page.reload();
  await page.getByRole('button', { name: /^Assets/ }).click();
  await expect(page.getByRole('button', { name: 'Order: by row' })).toBeVisible();
});

test('a row number goes to that row in Write', async ({ page }) => {
  const assets = await openAssets(page);
  await assets.locator('li.find').getByRole('button', { name: 'Row 5' }).click();
  await expect(page.getByLabel('Dialogue, row 5')).toBeFocused();
});

test('the script list says how many files are missing', async ({ page }) => {
  await setUp(page, '', { ...FILES, 'Trailer/script.md': '---\ntitle: Trailer\n---\n' });
  await expect(page.getByRole('link', { name: /How Photosynthesis Works/ }).locator('.missing')).toHaveText('2 missing');
  await expect(page.getByRole('link', { name: /Trailer/ }).locator('.missing')).toHaveCount(0);
});

test('a shot still to find is given to people from the folder or by name, saved in the script (#211)', async ({ page }) => {
  const jo = { v: 1, id: 'jo000001', name: 'Jo', role: 'Camera', email: '', linkedin: '', who: 'Kiva', when: '2026-11-10T10:00:00.000Z' };
  await setUp(page, '#/Episode%2003', { ...FILES, '.studio/people/20261110T100000Z_jo000001_aaaaaaaa.json': JSON.stringify(jo) });
  await page.getByRole('button', { name: /^Assets/ }).click();
  const shot = page.getByRole('region', { name: 'Assets' }).locator('li.find');
  await shot.getByRole('button', { name: '+ Who' }).click();
  await shot.getByRole('button', { name: /Jo\s*Camera/ }).click();
  await shot.getByRole('button', { name: '+ Who' }).click();
  await shot.getByLabel('Who finds or films it').fill('Lee');
  await shot.getByRole('button', { name: 'Add "Lee"' }).click();
  await expect(shot.locator('.person')).toHaveText(['Jo×', 'Lee×']);
  await expect.poll(() => readFile(page, 'Episode 03/script.md'), { timeout: 10000 }).toContain('- Park b-roll of a deep breath (to film: Jo, Lee)\n');

  await shot.getByRole('button', { name: 'Take Jo off Park b-roll of a deep breath (to film)' }).click();
  await expect(shot.locator('.person')).toHaveText(['Lee×']);
  await expect.poll(() => readFile(page, 'Episode 03/script.md'), { timeout: 10000 }).toContain('- Park b-roll of a deep breath (to film: Lee)\n');
  await page.getByRole('button', { name: 'Order: by what needs doing' }).click();
  await expect(page.locator('.by-row li.find')).toHaveText('To find: Park b-roll of a deep breath (to film) · Lee');
});
