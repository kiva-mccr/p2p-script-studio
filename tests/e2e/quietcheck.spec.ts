import { expect, test, type Page } from './base';
import { readFileSync } from 'node:fs';
import { changeFile, setUp, writeFile } from './folder';

// A quieter 5 s check (PF-8): a round that looks inside the script lists History once, and others' takes are looked
// at every 30 s (shortened here), not every round.
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const LEAF = 'Slow push-in on a sunlit leaf.';

async function openExample(page: Page) {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.waitForTimeout(2000); // opening is done
}

test('someone else’s take waits for the takes look, while their save shows at the next check', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('takes-every', '15000'));
  await openExample(page);
  await expect(page.locator('header .voice')).toHaveText('0:25');
  await writeFile(page, 'Episode 03/voice/row-p8x2m.json', JSON.stringify({ by: 'Alex', at: Date.now(), seconds: 4, text: 'x' }));
  const [path, text] = changeFile('Episode 03', 'Ana', example, example.replace(LEAF, 'Ana was here.'));
  await writeFile(page, path, text);
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Ana was here.', { timeout: 8000 });
  await expect(page.locator('header .voice')).toHaveText('0:25'); // that round looked inside, but not at takes
  await expect(page.locator('header .voice')).toHaveText('0:04/0:25', { timeout: 20000 });
});

test('a round that looks inside the script lists History once', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { historyLists: number };
    w.historyLists = 0;
    const D = FileSystemDirectoryHandle.prototype as unknown as Record<string, (this: FileSystemDirectoryHandle) => unknown>;
    for (const name of ['keys', 'entries', 'values']) {
      const orig = D[name];
      D[name] = function () {
        if (this.name === 'versions') w.historyLists++;
        return orig.call(this);
      };
    }
  });
  await openExample(page);
  const lists = () => page.evaluate(() => (window as unknown as { historyLists: number }).historyLists);
  const before = await lists();
  const [path, text] = changeFile('Episode 03', 'Ana', example, example.replace(LEAF, 'Ana was here.'));
  await writeFile(page, path, text);
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Ana was here.', { timeout: 8000 });
  await page.waitForTimeout(6000); // the round after a note looks inside once more
  // Two rounds looked inside (the note's and the one after): once each, as the keeper's sync lists it anyway.
  expect(await lists() - before).toBeLessThanOrEqual(2);
});
