import { expect, test, type Locator, type Page } from './base';
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

// AP-49: holding Shift lets clicks through to the page, to open a menu and then pick a part inside it.
test('holding Shift opens a menu while picking, and a part inside it can be picked', async ({ page }) => {
  await openScript(page);
  await startFeedback(page);
  await expect(page.getByRole('status').filter({ hasText: 'Hold Shift to use the page' })).toBeVisible();

  // Shift is let go before the mouse button: the press began with Shift, so the click still goes through.
  const q = await page.getByRole('button', { name: 'Help and version' }).boundingBox();
  await page.mouse.move(q!.x + q!.width / 2, q!.y + q!.height / 2);
  await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.keyboard.up('Shift');
  await page.mouse.up();
  const menu = page.getByRole('menu', { name: 'Help and version' });
  await expect(menu).toBeVisible();
  await expect(page.getByRole('region', { name: 'Feedback' })).toHaveCount(0);

  // Without Shift the click picks again; the menu stays open and its link isn't followed.
  await menu.getByRole('menuitem', { name: 'GitHub ↗' }).click();
  await expect(page.getByRole('region', { name: 'Feedback' }).getByRole('heading')).toHaveText('Feedback on: menu item "GitHub ↗"');
  await expect(menu).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
});

test('the picture covers names and the script in solid grey, but not "In review" or "Saved"', async ({ page }) => {
  const ago = new Date(Date.now() - 3 * 3600000).toISOString();
  const ana = JSON.stringify({ v: 1, who: 'Ana', since: ago, seen: ago, last_written: '', left: ago });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example, 'Episode 03/.studio/editing/ana_20261101T120000000Z.json': ana });
  const last = page.getByRole('button', { name: 'Ana · 3 h ago' });
  await expect(last).toBeVisible(); // the script is open: a menu opened while it loads can close again
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

test('the note starts empty each time, but Pick again before sending keeps it (a bug the user hit)', async ({ page }) => {
  await openScript(page);
  const panel = page.getByRole('region', { name: 'Feedback' });
  const note = panel.getByRole('textbox');

  // Sent, then closed: the next feedback starts empty.
  await startFeedback(page);
  await page.getByRole('button', { name: 'Record row 1' }).click();
  await note.fill('First note.');
  await issueFrom(page, () => panel.getByRole('button', { name: 'Open on GitHub' }).click());
  await panel.getByRole('button', { name: 'Close' }).click();
  await startFeedback(page);
  await page.getByRole('button', { name: 'Record row 1' }).click();
  await expect(note).toHaveValue('');

  // Pick again before sending keeps the note; after copying, it starts empty.
  await note.fill('Second note.');
  await panel.getByRole('button', { name: 'Pick again' }).click();
  await page.getByLabel('Dialogue, row 1').click();
  await expect(note).toHaveValue('Second note.');
  await panel.getByRole('button', { name: 'Copy instead' }).click();
  await expect(panel.getByRole('status')).toContainText('Copied');
  await panel.getByRole('button', { name: 'Pick again' }).click();
  await page.getByRole('button', { name: 'Record row 1' }).click();
  await expect(note).toHaveValue('');

  // Cancelled: gone too.
  await note.fill('Third note.');
  await panel.getByRole('button', { name: 'Cancel' }).click();
  await startFeedback(page);
  await page.getByRole('button', { name: 'Record row 1' }).click();
  await expect(note).toHaveValue('');
});

test("the timeline's preview is pictured itself, not the drawer's bar under it (issue #247)", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('prompter-speed', '20'); // slow, so row 1 (no take) stays on the preview
    // Play needs a take: recording gives a short silent WAV.
    const wav = () => {
      const n = 800, buf = new DataView(new ArrayBuffer(44 + n * 2));
      const text = (at: number, s: string) => [...s].forEach((c, i) => buf.setUint8(at + i, c.charCodeAt(0)));
      text(0, 'RIFF'); buf.setUint32(4, 36 + n * 2, true); text(8, 'WAVEfmt '); buf.setUint32(16, 16, true);
      buf.setUint16(20, 1, true); buf.setUint16(22, 1, true); buf.setUint32(24, 8000, true); buf.setUint32(28, 16000, true);
      buf.setUint16(32, 2, true); buf.setUint16(34, 16, true); text(36, 'data'); buf.setUint32(40, n * 2, true);
      return new Blob([buf], { type: 'audio/wav' });
    };
    (window as unknown as { studioRecord: () => Promise<{ stop: () => Promise<Blob> }> }).studioRecord = async () => ({ stop: async () => wav() });
  });
  await openScript(page);
  await page.getByRole('button', { name: 'Record row 2', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording row 2' }).click();
  await page.getByRole('button', { name: 'Play from row 1' }).click();
  const preview = page.locator('.preview');
  await expect(preview).toBeVisible();
  await startFeedback(page);
  await preview.locator('.screen').click();
  const panel = page.getByRole('region', { name: 'Feedback' });
  await expect(panel.getByRole('heading')).toHaveText(/^Feedback on: /);
  const picture = panel.getByRole('img', { name: 'The part, outlined' });
  await expect(picture).toBeVisible();
  // The picture is the preview with its 12 px margin, not the drawer's bar the width of the window.
  const box = (await preview.boundingBox())!;
  const size = await picture.evaluate(async (img: HTMLImageElement) => (await img.decode(), [img.naturalWidth, img.naturalHeight]));
  expect(size[0]).toBeLessThanOrEqual(box.width + 26);
  expect(size[1]).toBeGreaterThan(box.height);
  await panel.getByRole('button', { name: 'Cancel' }).click();
  await page.keyboard.press('Escape');
});
