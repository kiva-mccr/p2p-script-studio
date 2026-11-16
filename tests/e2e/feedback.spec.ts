import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

// Feedback mode (AP-48, board 71): click a part, write a note, and GitHub's new issue page opens filled in.

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const firstLine = 'Every leaf you have ever seen is running a tiny factory.';

async function openScript(page: Page) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.context().route('https://github.com/**', (r) => r.fulfill({ body: 'GitHub' }));
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue(firstLine);
}

// Feedback… is in the ? menu of the top bar (SB-5).
async function startFeedback(page: Page) {
  await page.getByRole('button', { name: 'Help and version' }).click();
  await page.getByRole('menuitem', { name: 'Feedback…' }).click();
  await expect(page.getByRole('menu', { name: 'Help and version' })).toHaveCount(0);
}

async function issueFrom(page: Page, click: () => Promise<void>) {
  const popup = page.waitForEvent('popup');
  await click();
  const url = new URL((await popup).url());
  return { url, title: url.searchParams.get('title')!, body: url.searchParams.get('body')! };
}

test('clicking a part opens a GitHub issue that says what and where, with the picture copied', async ({ page }) => {
  await openScript(page);
  await startFeedback(page);
  await expect(page.getByRole('status').filter({ hasText: 'click the part' })).toBeVisible();

  // The click picks the part; the page's own click is held back (no recording starts).
  await page.getByRole('button', { name: 'Record row 1' }).click();
  const panel = page.getByRole('region', { name: 'Feedback' });
  await expect(panel.getByRole('heading')).toHaveText('Feedback on: button "Record row 1", row 1');
  await expect(page.getByRole('button', { name: 'Stop recording row 1' })).toHaveCount(0);
  await expect(panel.getByRole('textbox')).toBeFocused();
  await panel.getByRole('textbox').fill('Hard to tell when it is recording.');
  const picture = panel.getByRole('img', { name: 'The part, outlined' });
  await expect(picture).toBeVisible();
  // Unblurred, the picture is made again.
  const blurred = await picture.getAttribute('src');
  await panel.getByLabel("Cover the script's words and names").uncheck();
  await expect(picture).not.toHaveAttribute('src', blurred!);
  await panel.getByLabel("Cover the script's words and names").check();
  await expect(picture).toBeVisible();

  const { url, title, body } = await issueFrom(page, () => panel.getByRole('button', { name: 'Open on GitHub' }).click());
  expect(url.origin + url.pathname).toBe('https://github.com/kiva-mccr/p2p-script-studio/issues/new');
  expect(url.searchParams.get('labels')).toBe('feedback');
  expect(title).toBe('Feedback: button "Record row 1" (Write)');
  expect(body).toContain('Hard to tell when it is recording.');
  expect(body).toContain('| Screen | Write |');
  expect(body).toContain('| Code | WriteRow.svelte, data-tour="take" |');
  expect(body).toContain('| Row, column | row 1, the mic |');
  expect(body).toMatch(/\| Selector \| `\[data-row="[^"]+"\] > .*button\.mic/);
  expect(body).toContain('| Version | dev build |');
  expect(body).toMatch(/\| Browser \| Chrome \d+ on \w+, window 1280 × 720 \|/);
  expect(body).toContain('Paste the picture here');
  // Nothing from the script unless allowed: no name, no address, no words.
  expect(body).not.toContain('Episode');
  expect(body).not.toContain('tiny factory');
  await expect(panel.getByRole('status')).toContainText('The picture is copied');
  const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((i) => i.types));
  expect(types).toContain('image/png');

  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel).toHaveCount(0);
  // Back to normal: the mic records again.
  await expect(page.locator('html')).not.toHaveClass(/feedback-picking/);
});

test('a text box says its column; the script can be named; Copy instead copies the same text', async ({ page }) => {
  await openScript(page);
  await startFeedback(page);
  await page.getByLabel('On screen, row 2').click();
  const panel = page.getByRole('region', { name: 'Feedback' });
  await expect(panel.getByRole('heading')).toHaveText('Feedback on: text box "On screen, row 2", row 2');
  await panel.getByLabel('Say which script').check();
  await panel.getByLabel('Add a picture of this part').uncheck();
  await expect(panel.getByRole('img')).toHaveCount(0);

  await panel.getByRole('button', { name: 'Copy instead' }).click();
  await expect(panel.getByRole('status')).toHaveText(/^Copied\./);
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/^Feedback: text box "On screen, row 2" \(Write\)\n\n\*\*Note\*\*/);
  expect(text).toContain('| Row, column | row 2, On screen |');
  expect(text).toContain('| Script | Episode 03 |');
  expect(text).toContain('| Screen | Write (#/Episode%2003) |');
  expect(text).not.toContain('Paste the picture');

  const { body } = await issueFrom(page, () => panel.getByRole('button', { name: 'Open on GitHub' }).click());
  expect(body).not.toContain('**Picture**');
  await expect(panel.getByRole('status')).toHaveText(/Press Submit new issue there\.$/);
});

test("a file's name is the script's, so it's left out of the part's name", async ({ page }) => {
  await openScript(page);
  await startFeedback(page);
  await page.getByRole('button', { name: 'leaf-closeup.jpg', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Feedback' });
  await expect(panel.getByRole('heading')).toHaveText('Feedback on: button (a file), row 1');
  await panel.getByRole('button', { name: 'Cancel' }).click();
  await expect(panel).toHaveCount(0);
});

test('the panel is always whole on screen, even in a short window (a bug the user hit)', async ({ page }) => {
  await openScript(page);
  for (const [height, row] of [[520, 'Record row 2'], [800, 'Record row 4'], [800, 'Record row 1']] as const) {
    await page.setViewportSize({ width: 1280, height });
    await startFeedback(page);
    await page.getByRole('button', { name: row }).click();
    const panel = page.getByRole('region', { name: 'Feedback' });
    await expect(panel.getByRole('img', { name: 'The part, outlined' })).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height);
    expect(box.x + box.width).toBeLessThanOrEqual(1280);
    await panel.getByRole('button', { name: 'Cancel' }).click();
  }
});

test('Esc stops picking, and the page works as before', async ({ page }) => {
  await openScript(page);
  await startFeedback(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('status').filter({ hasText: 'click the part' })).toHaveCount(0);
  await page.getByLabel('Dialogue, row 1').click();
  await expect(page.getByLabel('Dialogue, row 1')).toBeFocused();
  await expect(page.getByRole('region', { name: 'Feedback' })).toHaveCount(0);
});

test('the picture covers names and the script in solid grey, but not "In review" or "Saved"', async ({ page }) => {
  const ago = new Date(Date.now() - 3 * 3600000).toISOString();
  const ana = JSON.stringify({ v: 1, who: 'Ana', since: ago, seen: ago, last_written: '', left: ago });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example, 'Episode 03/.studio/editing/ana_20261101T120000000Z.json': ana });
  const last = page.getByRole('button', { name: 'Ana · 3 h ago' });
  await startFeedback(page);
  await last.click();
  const panel = page.getByRole('region', { name: 'Feedback' });
  const picture = panel.getByRole('img', { name: 'The part, outlined' });
  await expect(picture).toBeVisible();
  // The colour at the middle of each part, found in the picture of the bar (12 px of margin round it).
  const bar = (await page.locator('header').first().boundingBox())!;
  const spots = await Promise.all([last.locator('[data-hide]'), page.getByText('In review', { exact: true }), page.locator('header .title'),
    page.getByRole('status').filter({ hasText: 'Saved' })].map(async (l) => (await l.boundingBox())!));
  const colours = await picture.evaluate(async (img: HTMLImageElement, { bar, spots }) => {
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const scale = img.naturalWidth / (bar.width + 24);
    // Every pixel down the middle of the part, left to right, but the rounded ends.
    return spots.map((s) => {
      const y = Math.round((s.y - bar.y + 12 + s.height / 2) * scale);
      const xs = [0.25, 0.5, 0.75].map((f) => Math.round((s.x - bar.x + 12 + s.width * f) * scale));
      return xs.map((x) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)].join(','));
    });
  }, { bar, spots });
  const grey = '163,163,163';
  expect(colours[0]).toEqual([grey, grey, grey]); // Ana's name
  expect(colours[1]).not.toContain(grey); // In review
  expect(colours[2]).toEqual([grey, grey, grey]); // the script's name
  expect(colours[3]).not.toContain(grey); // Saved
});

// How many red pixels the feedback picture has.
const redPixels = (picture: Locator) =>
  picture.evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] > 200 && d[i + 1] < 60 && d[i + 2] < 60) n++;
    return n;
  });

test('pictures in the picture are covered too', async ({ page }) => {
  const red = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#ff0000"/></svg>';
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example, 'Episode 03/assets/icons-ingredients.svg': red });
  const shown = page.locator('[data-row]').nth(1).locator('img');
  await expect(shown.first()).toBeVisible();
  await startFeedback(page);
  await page.getByLabel('Dialogue, row 2').click();
  const picture = page.getByRole('region', { name: 'Feedback' }).getByRole('img', { name: 'The part, outlined' });
  await expect(picture).toBeVisible();
  // Not one red pixel: the preview is a grey box.
  const reds = await redPixels(picture);
  expect(reds).toBe(0);
  // And it was there to cover: unticked, the preview shows.
  await page.getByRole('region', { name: 'Feedback' }).getByLabel("Cover the script's words and names").uncheck();
  await expect.poll(() => redPixels(picture)).toBeGreaterThan(0);
});
