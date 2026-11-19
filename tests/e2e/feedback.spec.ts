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
  // Uncovered, the other picture shows; covered again, the first comes back as it was (issue #244).
  const blurred = await picture.getAttribute('src');
  await panel.getByLabel("Cover the script's words and names").uncheck();
  await expect(picture).not.toHaveAttribute('src', blurred!);
  await panel.getByLabel("Cover the script's words and names").check();
  await expect(picture).toHaveAttribute('src', blurred!);

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
  await menu.getByRole('menuitem', { name: 'GitHub', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Feedback' }).getByRole('heading')).toHaveText('Feedback on: menu item "GitHub"');
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

test('ticking Cover off shows the picture from when the part was picked, not the page as it is now (issue #244)', async ({ page }) => {
  const red = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#ff0000"/></svg>';
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example, 'Episode 03/assets/icons-ingredients.svg': red });
  const shown = page.locator('[data-row]').nth(1).locator('img');
  await expect(shown.first()).toBeVisible();
  await startFeedback(page);
  await page.getByLabel('Dialogue, row 2').click();
  const panel = page.getByRole('region', { name: 'Feedback' });
  const picture = panel.getByRole('img', { name: 'The part, outlined' });
  await expect(picture).toBeVisible();
  // Wait until both pictures are made, then change the page: the red preview goes.
  await panel.getByLabel("Cover the script's words and names").uncheck();
  await expect.poll(() => redPixels(picture)).toBeGreaterThan(0);
  await panel.getByLabel("Cover the script's words and names").check();
  await shown.first().evaluate((img) => (img.style.visibility = 'hidden'));
  // Unticked again, the picture is still the one from the pick: the red preview is in it.
  await panel.getByLabel("Cover the script's words and names").uncheck();
  await expect(picture).toBeVisible();
  expect(await redPixels(picture)).toBeGreaterThan(0);
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

// Whether the middle of each spot's words is solid grey in the covered picture of the picked part: the picture is of its
// widest parent that fits the window and 480 px of height (`pictureRoot` in lib/feedbackshot.ts), with 12 px round it.
async function greyAt(picture: Locator, part: Locator, spots: Locator[]) {
  const at = await part.evaluate((el) => {
    let root = el;
    const p0 = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const r = p.getBoundingClientRect();
      if (r.width > innerWidth + 1 || r.height > 480) break;
      if (p0.left < r.left - 1 || p0.top < r.top - 1 || p0.right > r.right + 1 || p0.bottom > r.bottom + 1) break;
      root = p;
    }
    const r = root.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width };
  });
  // Where each spot's words are (not its padding, which is never covered).
  const boxes = await Promise.all(spots.map((l) => l.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getClientRects()[0];
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  })));
  return picture.evaluate(async (img: HTMLImageElement, { at, boxes }) => {
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const scale = img.naturalWidth / (at.width + 24);
    return boxes.map((s) => {
      const y = Math.round((s.y - at.y + 12 + s.height / 2) * scale);
      return [0.3, 0.5, 0.7].every((f) => {
        const x = Math.round((s.x - at.x + 12 + s.width * f) * scale);
        return [...g.getImageData(x, y, 1, 1).data.slice(0, 3)].join(',') === '163,163,163';
      });
    });
  }, { at, boxes });
}

test('Cover leaves the app\'s own words on buttons in a row, but covers file names and names (issue #257)', async ({ page }) => {
  await openScript(page);
  const row = page.locator('[data-row]').first();
  await page.getByRole('button', { name: 'Flag row 1' }).click();
  await startFeedback(page);
  await row.getByRole('button', { name: '+ Add' }).click({ modifiers: ['Shift'] }); // opening ? closes the add menu (#263)
  await expect(row.getByRole('button', { name: 'Choose a file…' })).toBeVisible();
  const clear = row.getByRole('button', { name: 'Clear', exact: true });
  await clear.click();
  const picture = page.getByRole('region', { name: 'Feedback' }).getByRole('img', { name: 'The part, outlined' });
  await expect(picture).toBeVisible();
  const grey = await greyAt(picture, clear, [clear, row.getByRole('button', { name: 'Choose a file…' }),
    row.getByRole('button', { name: 'Reuse a file…' }), row.locator('.flag-note .by'), row.locator('.chip [data-hide]').first()]);
  expect(grey).toEqual([false, false, false, true, true]); // Clear, Choose a file…, Reuse a file…, Sam, a file's name
});

test('Cover leaves "commented" on a comment card, but covers who wrote it (issue #257)', async ({ page }) => {
  const id = example.match(/## 4 <!-- id: (\w+) -->/)![1];
  const ben = JSON.stringify({ v: 1, id: 'ben00001', kind: 'comment', who: 'Benedict', when: '2026-11-10T09:02:00Z', row: id, field: 'dialogue', quote: '', text: 'Say where the oxygen goes too.' });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example, 'Episode 03/.studio/comments/20261110T090200Z_ben00001.json': ben });
  await page.getByRole('button', { name: '1 open comment on row 4' }).click();
  const card = page.getByRole('article', { name: 'Comment by Benedict' });
  await expect(card).toContainText('Benedict commented · row 4');
  await startFeedback(page);
  await card.locator('.who strong').click();
  const picture = page.getByRole('region', { name: 'Feedback' }).getByRole('img', { name: 'The part, outlined' });
  await expect(picture).toBeVisible();
  expect(await greyAt(picture, card.locator('.who strong'), [card.locator('.who strong'), card.locator('.who [data-keep]'), card.locator('p.text')]))
    .toEqual([true, false, true]); // the name, "commented · row 4", the comment's words
});

test("a part as big as the window keeps its outline on screen (issue #216)", async ({ page }) => {
  await openScript(page);
  await startFeedback(page);
  await page.keyboard.down('Shift');
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.keyboard.up('Shift');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();

  // The Settings backdrop fills the window: its outline used to sit just past every edge.
  await page.mouse.click(6, 400);
  await expect(page.getByRole('region', { name: 'Feedback' }).getByRole('heading')).toHaveText('Feedback on: presentation');
  const view = page.viewportSize()!;
  const ring = (await page.locator('.ring').boundingBox())!;
  expect(ring.x).toBeGreaterThanOrEqual(0);
  expect(ring.y).toBeGreaterThanOrEqual(0);
  expect(ring.x + ring.width).toBeLessThanOrEqual(view.width);
  expect(ring.y + ring.height).toBeLessThanOrEqual(view.height);
  expect(ring.width).toBeGreaterThan(view.width - 40);
});

test("the picture shows the chosen row's blue, as the app does (issue #235)", async ({ page }) => {
  const id = example.match(/## 4 <!-- id: (\w+) -->/)![1];
  const ben = JSON.stringify({ v: 1, id: 'ben00001', kind: 'comment', who: 'Benedict', when: '2026-11-10T09:02:00Z', row: id, field: 'dialogue', quote: '', text: 'Say where the oxygen goes too.' });
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example, 'Episode 03/.studio/comments/20261110T090200Z_ben00001.json': ben });
  const bubble = page.getByRole('button', { name: '1 open comment on row 4' });
  await bubble.click();
  const row = page.locator('.row.talking');
  await expect(row).toHaveCSS('background-color', 'rgb(238, 243, 253)');
  await startFeedback(page);
  // The bubble sticks out of its number cell a little: the picture is still of the whole row, not the cell.
  await bubble.click();
  const picture = page.getByRole('region', { name: 'Feedback' }).getByRole('img', { name: 'The part, outlined' });
  await expect(picture).toBeVisible();
  const box = (await row.boundingBox())!;
  const colour = await picture.evaluate(async (img: HTMLImageElement, box) => {
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const scale = img.naturalWidth / (box.width + 24);
    // An empty spot near the bottom of the row, in the middle (12 px of margin round the row).
    return [...g.getImageData(Math.round((12 + box.width / 2) * scale), Math.round((12 + box.height - 12) * scale), 1, 1).data.slice(0, 3)].join(',');
  }, box);
  expect(colour).toBe('238,243,253');
});

test("Cover hides the timeline's section titles and its words, but keeps its times (issue #334)", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('timeline-open', '1'));
  await openScript(page);
  const timeline = page.getByRole('region', { name: 'Timeline' });
  const sec = timeline.locator('.sec').first();
  await expect(sec).toBeVisible();
  await startFeedback(page);
  await sec.click();
  const picture = page.getByRole('region', { name: 'Feedback' }).getByRole('img', { name: 'The part, outlined' });
  await expect(picture).toBeVisible();
  const tick = timeline.locator('.ruler span').nth(1);
  expect(await greyAt(picture, sec, [sec.locator('[data-hide]'), sec.locator('.len'), tick]))
    .toEqual([true, false, false]); // the section's title, its length, a time on the ruler
});
