import { expect, test } from './base';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

const script = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

// PF-7: leaving a script lets the browser free all of it. The file previews' page-long watcher (lib/near.ts) once
// kept the first script opened in a visit alive, with all its History texts (110 MB on a big script).
test('a script left for the list is freed from memory', async ({ page }) => {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': script });
  await expect(page.locator('[data-tour="files"]').first()).toBeVisible();
  await page.evaluate(() => {
    const w = window as unknown as { leftRow?: WeakRef<Element> };
    w.leftRow = new WeakRef(document.querySelector('[data-tour="files"]')!);
  });
  await page.getByRole('link', { name: 'Back to Video Scripts' }).click();
  await expect(page.getByRole('link', { name: /How Photosynthesis Works/ })).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  await expect
    .poll(async () => {
      await cdp.send('HeapProfiler.collectGarbage');
      return page.evaluate(() => (window as unknown as { leftRow: WeakRef<Element> }).leftRow.deref() === undefined);
    })
    .toBe(true);
});
