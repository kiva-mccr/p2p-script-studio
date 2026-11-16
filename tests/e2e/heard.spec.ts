import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile, setUp } from './folder';

// SB-8: cuts on a word timed from the take, heard by a stand-in for the speech model (`window.studioHear`).
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const svg = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="${fill}"/></svg>`;
const line = 'It needs three simple ingredients: sunlight, water, and carbon dioxide.';
// Row 2: two pictures, cut on "carbon".
const script = example.replace('- assets/icons-ingredients.svg\n- assets/music-bed.mp3\n', '- assets/icons-ingredients.svg\n- assets/music-bed.mp3\n- assets/sun.svg (timeline)\n\nTimeline: cuts at "carbon"\n');
const files = (take: boolean): Record<string, string> => ({
  'Episode 03/script.md': script,
  'Episode 03/assets/icons-ingredients.svg': svg('#2b67a8'),
  'Episode 03/assets/sun.svg': svg('#b5651d'),
  ...(take ? { 'Episode 03/voice/row-p8x2m.webm': 'sound', 'Episode 03/voice/row-p8x2m.json': JSON.stringify({ by: 'Alex', at: 1, seconds: 10, text: line }) } : {}),
});

test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('timeline-open', '1')));

const timeline = (page: Page) => page.getByRole('region', { name: 'Timeline' });
const firstShare = (page: Page) => timeline(page).getByRole('button', { name: /^Row 2 · / }).locator('.shot').first()
  .evaluate((el) => parseFloat((el as HTMLElement).style.width));

test('a row cut on a word has its take heard once, and the cut falls where the word is said', async ({ page }) => {
  // The stand-in hears a long pause before "carbon", said 9 s in.
  await page.addInitScript(() => {
    const w = window as unknown as { studioHear: () => Promise<[string, number][]>; heardTimes: number };
    w.heardTimes = 0;
    w.studioHear = async () => {
      w.heardTimes++;
      await new Promise((r) => setTimeout(r, 300));
      return [['It', 0], ['needs', 0.3], ['three', 0.6], ['simple', 0.9], ['ingredients:', 1.3], ['sunlight,', 2], ['water,', 2.6], ['and', 3], ['carbon', 9], ['dioxide.', 9.4]];
    };
  });
  await setUp(page, '#/Episode%2003', files(true));
  // Heard: picture 1 lasts until "carbon", 90% of the row (estimated by letters it was about 75%).
  await expect.poll(() => firstShare(page)).toBeCloseTo(90, 0);
  await timeline(page).getByRole('button', { name: /^Row 2 · / }).click();
  await expect(timeline(page).getByText('Cuts timed from the take.')).toBeVisible();
  // Kept with the take, so it is heard once for everyone.
  await expect.poll(async () => JSON.parse(await readFile(page, 'Episode 03/voice/row-p8x2m.json')).words?.length).toBe(10);
  expect(JSON.parse(await readFile(page, 'Episode 03/voice/row-p8x2m.json')).by).toBe('Alex');
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as unknown as { heardTimes: number }).heardTimes)).toBe(1);
});

test('without a take, the cuts are estimated and say so', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files(false));
  await timeline(page).getByRole('button', { name: /^Row 2 · / }).click();
  await expect(timeline(page).getByText('Cuts estimated (no take).')).toBeVisible();
  // Cut on "carbon" by letters: about three quarters of the way.
  expect(await firstShare(page)).toBeGreaterThan(65);
  expect(await firstShare(page)).toBeLessThan(85);
});

test('a take that can\'t be heard keeps the estimate and says so', async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { studioHear: () => Promise<never> }).studioHear = async () => { throw new Error('no model'); }));
  await setUp(page, '#/Episode%2003', files(true));
  await timeline(page).getByRole('button', { name: /^Row 2 · / }).click();
  await expect(timeline(page).getByText('Cuts estimated: the take couldn’t be heard.')).toBeVisible();
  expect(await firstShare(page)).toBeLessThan(85);
});
