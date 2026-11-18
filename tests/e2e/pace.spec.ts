import { expect, test } from './base';
import { readFileSync } from 'node:fs';
import { changeFile, setUp, writeFile } from './folder';

// Check fast only when someone else is there (PF-16): every 5 s while another person's "… is editing" file is fresh,
// every 30 s (15 s here) when you're alone in the script.
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const LEAF = 'Slow push-in on a sunlit leaf.';

test('alone, the check comes every 30 s; once someone else is in, every 5 s', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(() => {
    localStorage.setItem('alone-every', '15000');
    const w = window as unknown as { newsLists: number };
    w.newsLists = 0;
    const D = FileSystemDirectoryHandle.prototype as unknown as Record<string, (this: FileSystemDirectoryHandle) => unknown>;
    for (const name of ['keys', 'entries', 'values']) {
      const orig = D[name];
      D[name] = function () {
        if (this.name === 'news') w.newsLists++;
        return orig.call(this);
      };
    }
  });
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  const lists = () => page.evaluate(() => (window as unknown as { newsLists: number }).newsLists);
  await page.waitForTimeout(2000); // opening is done
  let before = await lists();
  await page.waitForTimeout(12000);
  expect(await lists() - before).toBeLessThanOrEqual(1); // at most one round in 12 s, not two or three

  const now = new Date().toISOString();
  await writeFile(page, 'Episode 03/.studio/editing/ana_20261113T120000000Z.json', JSON.stringify({ v: 1, who: 'Ana', since: now, seen: now, last_written: '' }));
  await expect(page.getByText('Ana is editing')).toBeVisible({ timeout: 20000 }); // noticed at the next round
  before = await lists();
  await page.waitForTimeout(12000);
  expect(await lists() - before).toBeGreaterThanOrEqual(2); // every 5 s now
  const [path, text] = changeFile('Episode 03', 'Ana', example, example.replace(LEAF, 'Ana was here.'));
  await writeFile(page, path, text);
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Ana was here.', { timeout: 8000 });
});
