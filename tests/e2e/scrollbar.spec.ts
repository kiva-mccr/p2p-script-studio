import { expect, test } from './base';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

// Headless Chromium hides scrollbars, so nothing could shift: show them, as on a real desktop.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

test("the top bar's buttons stay put when a tab is too short to scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible(); // Write is longer than the window: it scrolls
  const share = page.getByRole('button', { name: 'Export / Share' });
  const x = async () => (await share.boundingBox())!.x;
  const inWrite = await x();
  for (const tab of [/^Review/, /^History/, /^Assets/]) { // History and Assets are short here
    await page.getByRole('button', { name: tab }).click();
    await expect.poll(x).toBe(inWrite);
  }
});

test("in feedback mode, the timeline's scroll bar is picked, not dragged, unless Shift is held (issue #252)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('timeline-open', '1'));
  await page.setViewportSize({ width: 1280, height: 800 });
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  const scroll = page.locator('[data-tour="timeline"] .scroll');
  await expect(scroll).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in' }).click(); // the timeline is now twice the window: it scrolls
  await expect.poll(() => scroll.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  const box = (await scroll.boundingBox())!;
  const bar = await scroll.evaluate((el: HTMLElement) => el.offsetHeight - el.clientHeight);
  expect(bar).toBeGreaterThan(0);
  const drag = async (shift: boolean) => {
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.move(box.x + 30, box.y + box.height - bar / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 400, box.y + box.height - bar / 2, { steps: 8 });
    await page.mouse.up();
    if (shift) await page.keyboard.up('Shift');
  };
  const left = () => scroll.evaluate((el) => el.scrollLeft);
  await page.getByRole('button', { name: 'Help and version' }).click();
  await page.getByRole('menuitem', { name: 'Feedback…' }).click();
  await drag(false);
  const panel = page.getByRole('region', { name: 'Feedback' });
  await expect(panel.getByRole('heading')).toHaveText('Feedback on: div');
  expect(await left()).toBe(0);
  // Holding Shift uses the page, scroll bars too.
  await panel.getByRole('button', { name: 'Pick again' }).click();
  await drag(true);
  await expect.poll(left).toBeGreaterThan(0);
  await expect(panel).toHaveCount(0);
  await page.keyboard.press('Escape');
});
