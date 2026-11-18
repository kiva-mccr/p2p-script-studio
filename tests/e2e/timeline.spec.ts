import { expect, test, type Page } from './base';
import { readFileSync } from 'node:fs';
import { readFile, readJsonFiles, setUp, webm } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const svg = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="${fill}"/></svg>`;
// Row 2 gets a second picture only for the timeline.
const script = example.replace('- assets/icons-ingredients.svg\n', '- assets/icons-ingredients.svg\n- assets/sun.svg (timeline)\n');
const files = {
  'Episode 03/script.md': script,
  'Episode 03/assets/icons-ingredients.svg': svg('#2b67a8'),
  'Episode 03/assets/sun.svg': svg('#b5651d'),
};

// The drawer (SB-4) starts folded; these tests open it, except the one about folding.
test.beforeEach(({ page }) => page.addInitScript(() => localStorage.getItem('timeline-open') ?? localStorage.setItem('timeline-open', '1')));

const timeline = (page: Page) => page.getByRole('region', { name: 'Timeline' });
const saved = (page: Page) => expect.poll(() => readFile(page, 'Episode 03/script.md'), { timeout: 15000 });

// A made-up take: recording gives a 1.5 s WAV.
const fakeTake = (page: Page) =>
  page.addInitScript(() => {
    const wav = () => {
      const rate = 8000, n = rate * 1.5, buf = new DataView(new ArrayBuffer(44 + n * 2));
      const text = (at: number, s: string) => [...s].forEach((c, i) => buf.setUint8(at + i, c.charCodeAt(0)));
      text(0, 'RIFF'); buf.setUint32(4, 36 + n * 2, true); text(8, 'WAVEfmt '); buf.setUint32(16, 16, true);
      buf.setUint16(20, 1, true); buf.setUint16(22, 1, true); buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true);
      buf.setUint16(32, 2, true); buf.setUint16(34, 16, true); text(36, 'data'); buf.setUint32(40, n * 2, true);
      for (let i = 0.2 * rate; i < 1.3 * rate; i++) buf.setInt16(44 + i * 2, Math.round(8000 * Math.sin(i / 3)), true);
      return new Blob([buf], { type: 'audio/wav' });
    };
    (window as unknown as { studioRecord: () => Promise<{ stop: () => Promise<Blob> }> }).studioRecord = async () => ({ stop: async () => wav() });
  });

test('the timeline lays out the rows; a click lights up the row and opens its pictures', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  await expect(t.getByRole('button', { name: /^Row 1 · / })).toBeVisible();
  await expect(t.getByRole('button', { name: /^Intro ·/ })).toBeVisible();
  // A row with no take shows its read time.
  await expect(t.getByText(/no take · read time/).first()).toBeVisible();
  // Hover shows the dialogue.
  const row2 = t.getByRole('button', { name: /^Row 2 · / });
  await expect(row2).toHaveAccessibleName(/sunlight, water, and carbon dioxide/);
  await expect(row2.getByText('Sequence · 2')).toBeVisible();
  await row2.click();
  await expect(page.locator('.row.lit').getByLabel('Dialogue, row 2')).toBeVisible();
  await expect(t.locator('.panel strong')).toHaveText(/^Row 2 · /);
  await expect(t.getByRole('button', { name: /sun\.svg · timeline only/ })).toHaveAttribute('aria-pressed', 'true');
});

// #205: a video showed as a dark chip with its name, which looked unloaded; now its block shows a still of it.
test('a video in the timeline shows a still from it, not a chip', async ({ page }) => {
  const clip = await webm(page);
  await setUp(page, '#/Episode%2003', { ...files, 'Episode 03/script.md': script.replace('leaf-push-in.mp4', 'clip.webm'),
    'Episode 03/assets/clip.webm': clip });
  const row1 = timeline(page).getByRole('button', { name: /^Row 1 · / });
  const still = row1.locator('.still img');
  await expect(still).toBeVisible();
  expect(await still.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(row1.locator('.vid')).toHaveCount(0);
});

test('a click on a block brings its row into view above the drawer, and the panel stays at hand', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  // The drawer sits at the bottom of the screen from the start, while the script is at its top.
  const drawer = await t.boundingBox();
  expect(drawer!.y + drawer!.height).toBeGreaterThan(page.viewportSize()!.height - 2);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  const last = t.getByRole('button', { name: /^Row \d+ · / }).last();
  const n = (await last.getAttribute('aria-label'))!.match(/^Row (\d+)/)![1];
  await last.click();
  await expect(t.locator('.panel strong')).toHaveText(new RegExp(`^Row ${n} · `));
  const dialogue = page.getByLabel(`Dialogue, row ${n}`);
  await expect(dialogue).toBeInViewport();
  await expect.poll(async () => (await dialogue.boundingBox())!.y + (await dialogue.boundingBox())!.height).toBeLessThanOrEqual((await t.boundingBox())!.y);
  await expect(t.locator('.panel')).toBeInViewport();
  await expect(t.getByRole('button', { name: '↑ Go to the row' })).toHaveCount(0);
});

test('the last blocks\' hover text stays inside the timeline (UX-8)', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  await t.locator('.blk').last().scrollIntoViewIfNeeded();
  const last = t.locator('.blk').last();
  await last.hover();
  const tip = (await t.locator('.tip').boundingBox())!;
  const box = (await t.locator('.scroll').boundingBox())!;
  expect(tip.x + tip.width).toBeLessThanOrEqual(box.x + box.width + 1);
  await t.locator('.blk').first().hover();
  expect((await t.locator('.tip').boundingBox())!.x).toBeGreaterThanOrEqual(box.x - 1);
});

test('pictures: collage, leave one out', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  await t.getByRole('button', { name: /^Row 2 · / }).click();
  await t.getByRole('button', { name: 'Collage' }).click();
  await expect(t.getByRole('button', { name: /^Row 2 · / }).getByText('Collage')).toBeVisible();
  await saved(page).toContain('Timeline: collage\n');
  await t.getByRole('button', { name: /icons-ingredients\.svg/ }).click();
  await saved(page).toContain('Timeline: collage, without assets/icons-ingredients.svg\n');
});

test('a file only for the timeline is minimised in Files', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const cell = page.locator('[data-row="p8x2m"]');
  await expect(cell.getByRole('button', { name: 'sun.svg', exact: true })).toHaveCount(0);
  await cell.getByRole('button', { name: '+1 for the timeline' }).click();
  await expect(cell.getByRole('button', { name: 'sun.svg', exact: true })).toBeVisible();
});

test('holds and placeholders: added from the panel, a bar in the script, changed there, ✕ with Undo', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  await t.getByRole('button', { name: /^Row 2 · / }).click();
  await t.getByRole('button', { name: '+ Hold' }).click();
  await expect(t.getByRole('button', { name: /^Hold · 2 s/ })).toBeVisible();
  await saved(page).toContain('Timeline: then hold 2 s\n');
  // The bar in the script opens the same editing.
  const bar = page.getByRole('button', { name: 'Hold after row 2, 2 seconds' });
  await expect(bar).toHaveAttribute('aria-expanded', 'true'); // picked on the timeline, so open here too
  await bar.click();
  await expect(bar).toHaveAttribute('aria-expanded', 'false');
  await bar.click();
  await page.locator('.bar').getByRole('button', { name: 'Longer' }).click();
  await expect(page.getByRole('button', { name: 'Hold after row 2, 2.5 seconds' })).toBeVisible();
  await saved(page).toContain('Timeline: then hold 2.5 s\n');
  // A placeholder after row 4, with its words.
  await t.getByRole('button', { name: /^Row 4 · / }).click();
  await t.getByRole('button', { name: '+ Placeholder' }).click();
  await page.locator('.bar').last().getByLabel(/what goes here/).fill('Drone shot over a field');
  await saved(page).toContain('Timeline: then placeholder 3 s "Drone shot over a field"\n');
  // ✕ removes it at once; Undo puts it back.
  await page.getByRole('button', { name: 'Remove this placeholder' }).click();
  await expect(page.getByRole('button', { name: /^Placeholder after row 4/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: /^Placeholder after row 4/ })).toBeVisible();
});

test('the drawer starts folded, folds and unfolds, and is remembered', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('timeline-open')); // after beforeEach's: as for someone new
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  const bar = t.getByRole('button', { name: /^Timeline/ });
  // Folded: one slim bar at the bottom, with a strip of the blocks.
  await expect(bar).toHaveAttribute('aria-expanded', 'false');
  await expect(t.locator('.strip span').first()).toBeVisible();
  await expect(t.getByRole('button', { name: /^Row 1 · / })).toHaveCount(0);
  // Scrolled to the end, it still sits on the window's bottom edge, with no gap below it (#187).
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(async () => Math.round((await t.boundingBox())!.y + (await t.boundingBox())!.height)).toBe(page.viewportSize()!.height);
  await bar.click();
  await expect(bar).toHaveAttribute('aria-expanded', 'true');
  await expect(t.getByRole('button', { name: /^Row 1 · / })).toBeVisible();
  // Open, it takes at most about half the screen.
  expect((await t.boundingBox())!.height).toBeLessThanOrEqual(page.viewportSize()!.height / 2 + 4);
  // Opening the script again (from the list) keeps it open; folding is kept too.
  await page.getByRole('link', { name: 'Back to Video Scripts' }).click();
  await page.getByRole('link', { name: /How Photosynthesis Works/ }).click();
  await expect(timeline(page).getByRole('button', { name: /^Timeline/ })).toHaveAttribute('aria-expanded', 'true');
  await timeline(page).getByRole('button', { name: /^Timeline/ }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('timeline-open') ?? '')).toBe('');
});

test('folded, a push past the bottom unfolds it and scrolling up folds it; opened by hand, it stays (SB-5)', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('timeline-open')); // after beforeEach's: folded
  await setUp(page, '#/Episode%2003', files);
  const bar = timeline(page).getByRole('button', { name: /^Timeline/ });
  await expect(bar).toHaveAttribute('aria-expanded', 'false');
  await page.mouse.move(640, 300);
  // Reaching the bottom does nothing; a push past it unfolds the drawer.
  await page.mouse.wheel(0, 100000);
  await expect.poll(() => page.evaluate(() => innerHeight + scrollY >= document.documentElement.scrollHeight - 2)).toBe(true);
  await page.waitForTimeout(400); // a new push, not the same one going on
  await expect(bar).toHaveAttribute('aria-expanded', 'false');
  await page.mouse.wheel(0, 200);
  await expect(bar).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => localStorage.getItem('timeline-open'))).toBeNull(); // not remembered
  // Scrolling up folds it again.
  await page.waitForTimeout(300);
  await page.mouse.wheel(0, -200);
  await expect(bar).toHaveAttribute('aria-expanded', 'false');
  // Opened with its bar, it stays open when scrolling up.
  await bar.click();
  await expect(bar).toHaveAttribute('aria-expanded', 'true');
  await page.mouse.move(640, 200);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(300);
  await expect(bar).toHaveAttribute('aria-expanded', 'true');
});

test('cut on a word: a click on a word starts the next picture there', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  await t.getByRole('button', { name: /^Row 2 · / }).click();
  const words = t.getByRole('group', { name: 'Cut on a word' });
  await words.getByRole('button', { name: 'water,' }).click();
  await expect(words.getByRole('button', { name: 'water,' })).toHaveAttribute('aria-pressed', 'true');
  await saved(page).toContain('Timeline: cuts at "water"\n');
  // Two pictures: one cut at most, so a click on another word moves it there (board 78).
  await words.getByRole('button', { name: 'carbon' }).click();
  await saved(page).toContain('Timeline: cuts at "carbon"\n');
  await expect(words.getByRole('button', { name: 'water,' })).toHaveAttribute('aria-pressed', 'false');
  // The first word takes no cut: picture 1 already starts there.
  await expect(words.getByRole('button', { name: 'It', exact: true })).toBeDisabled();
  await words.getByRole('button', { name: 'carbon' }).click();
  await saved(page).not.toContain('cuts at');
  // Taken off, the word under the pointer shows no "a cut would go here" line until the pointer leaves it.
  const line = () => words.getByRole('button', { name: 'carbon' }).evaluate((b) => getComputedStyle(b, '::before').content);
  expect(await line()).toBe('none');
  await words.getByRole('button', { name: 'and' }).hover();
  await words.getByRole('button', { name: 'carbon' }).hover();
  expect(await line()).not.toBe('none');
});

test('cut on a repeated word: the cut stays on the one picked', async ({ page }) => {
  const twice = script.replace('It needs three simple ingredients: sunlight, water, and carbon dioxide.', 'It needs water, light and water, and carbon dioxide.');
  await setUp(page, '#/Episode%2003', { ...files, 'Episode 03/script.md': twice });
  const t = timeline(page);
  await t.getByRole('button', { name: /^Row 2 · / }).click();
  const words = t.getByRole('group', { name: 'Cut on a word' });
  await words.getByRole('button', { name: 'water,' }).nth(1).click();
  await saved(page).toContain('Timeline: cuts at "water and"\n');
  await expect(words.getByRole('button', { name: 'water,' }).nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(words.getByRole('button', { name: 'water,' }).first()).toHaveAttribute('aria-pressed', 'false');
});

test('playing: the preview sits above the drawer, follows, a hold plays in silence', async ({ page }) => {
  await fakeTake(page);
  await page.addInitScript(() => localStorage.setItem('prompter-speed', '400'));
  await setUp(page, '#/Episode%2003', { ...files, 'Episode 03/script.md': script.replace('- assets/music-bed.mp3\n', '- assets/music-bed.mp3\n\nTimeline: then hold 1 s\n') });
  await page.getByRole('button', { name: 'Record row 2', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording row 2' }).click();
  const t = timeline(page);
  // The take shows as a waveform.
  await expect(t.getByRole('img', { name: /^Take, / })).toBeVisible();
  await page.getByRole('button', { name: 'Play from row 2' }).click();
  await expect(t.getByRole('img', { name: /^Preview: Row 2/ })).toBeVisible();
  const p = await page.locator('.preview').boundingBox(), top = await t.boundingBox();
  expect(p!.y + p!.height).toBeLessThanOrEqual(top!.y);
  await expect(t.getByRole('img', { name: 'Preview: Hold' })).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.bar.lit')).toBeVisible();
  await t.getByRole('button', { name: 'Make the preview big' }).click();
  await expect(page.locator('.preview.big')).toBeVisible();
  await page.keyboard.press('Escape'); // stops it (if the last rows haven't already)
  await expect(page.locator('.preview')).toHaveCount(0);
});

test('upright and big, the preview stays between the top bar and the drawer in a short window', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await fakeTake(page);
  await setUp(page, '#/Episode%2003', files);
  await page.getByRole('button', { name: 'Record row 2', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording row 2' }).click();
  const t = timeline(page);
  await t.getByRole('button', { name: 'Upright' }).click();
  await page.getByRole('button', { name: 'Play from row 2' }).click();
  await t.getByRole('button', { name: 'Make the preview big' }).click();
  await expect(page.locator('.preview.upright.big')).toBeVisible();
  const p = (await page.locator('.preview').boundingBox())!, head = (await page.locator('header').first().boundingBox())!;
  expect(p.y).toBeGreaterThanOrEqual(head.y + head.height);
  expect(p.y + p.height).toBeLessThanOrEqual((await t.boundingBox())!.y);
  await page.keyboard.press('Escape');
});

test('folded while playing: the strip shows the playhead, the preview sits above the bar, and it can unfold', async ({ page }) => {
  await fakeTake(page);
  await setUp(page, '#/Episode%2003', files);
  await page.getByRole('button', { name: 'Record row 2', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording row 2' }).click();
  const t = timeline(page);
  const bar = t.getByRole('button', { name: /^Timeline/ });
  await bar.click();
  await expect(bar).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Play from row 1' }).click();
  await expect(t.locator('.strip .head')).toBeVisible();
  const preview = t.getByRole('img', { name: /^Preview: / });
  await expect(preview).toBeInViewport();
  const p = await preview.boundingBox(), top = await t.boundingBox();
  expect(p!.y + p!.height).toBeLessThanOrEqual(top!.y);
  // Unfolds while playing: the tracks, with the playhead, and no panel until it stops.
  await bar.click();
  await expect(t.locator('.tracks .head')).toBeVisible();
  await expect(t.locator('.panel')).toHaveCount(0);
  await page.keyboard.press('Escape');
});

test('in Review the timeline is read only, and a click on a block comments on its row', async ({ page }) => {
  await setUp(page, '#/Episode%2003', { ...files, 'Episode 03/script.md': script.replace('- assets/music-bed.mp3\n', '- assets/music-bed.mp3\n\nTimeline: then hold 1 s\n') });
  await page.getByRole('button', { name: /^Review/ }).click();
  const t = timeline(page);
  await expect(t.getByText('click a block to comment on its row')).toBeVisible();
  // A hold comments on the row before it; no panel opens.
  await t.getByRole('button', { name: /^Hold · / }).click();
  await expect(t.locator('.panel')).toHaveCount(0);
  const form = page.getByRole('form', { name: 'New comment' });
  await expect(form).toContainText('Comment on row 2, on the timeline');
  await form.getByLabel('Comment', { exact: true }).fill('Hold this a bit longer?');
  await form.getByRole('button', { name: 'Add comment' }).click();
  await expect(page.getByRole('article', { name: 'Comment by Sam' })).toContainText('Sam commented · row 2, on the timeline');
  expect(await readJsonFiles(page, 'Episode 03/.studio/comments')).toMatchObject([{ kind: 'comment', row: 'p8x2m', on: 'timeline', quote: '' }]);
});
