import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readJsonFiles, setUp, writeChange } from './folder';

// Away (PF-14): no mouse, key or scroll for 2 minutes (4 s here) stops the 5 s check and the "… is editing" file;
// the first touch rejoins and catches up at once.
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const leaf = 'Slow push-in on a sunlit leaf.';

test('an away script stops checking until the mouse moves, then rejoins and catches up', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('away-after', '4000'));
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('On screen, row 1')).toHaveValue(leaf);
  const mine = async () => (await readJsonFiles(page, 'Episode 03/.studio/editing')).filter((e) => e.who === 'Sam' && !e.left);
  await expect.poll(async () => (await mine()).length).toBeGreaterThan(0);
  const before = (await mine()).map((e) => e.since).sort().at(-1);

  await page.waitForTimeout(5000); // away now
  await writeChange(page, 'Episode 03', 'Ana', example, example.replace(leaf, 'Ana’s change.'));
  await page.waitForTimeout(7000); // a check or two would have taken it
  await expect(page.getByLabel('On screen, row 1')).toHaveValue(leaf);

  await page.mouse.move(300, 300);
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Ana’s change.', { timeout: 3000 });
  // Back as the newest here, so someone who took over as keeper meanwhile keeps script.md.
  await expect.poll(async () => (await mine()).map((e) => e.since).sort().at(-1)! > before!).toBe(true);
});
