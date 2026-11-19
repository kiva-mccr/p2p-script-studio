import { expect, test, type Page } from './base';
import { readdirSync, readFileSync } from 'node:fs';
import { setUp } from './folder';

// The example with its pictures and real takes (a made-up voice), row 2 as a collage with a hold after it.
const dir = 'docs/example/Episode 03 - How Photosynthesis Works';
const script = readFileSync(`${dir}/script.md`, 'utf8').replace('- assets/music-bed.mp3\n', '- assets/music-bed.mp3\n- assets/zoom-sketch.svg (timeline)\n\nTimeline: collage, then hold 2 s\n');
const files: Record<string, string> = { 'Episode 03/script.md': script };
for (const sub of ['assets', 'voice']) {
  for (const name of readdirSync(`${dir}/${sub}`)) files[`Episode 03/${sub}/${name}`] = 'base64:' + readFileSync(`${dir}/${sub}/${name}`).toString('base64');
}

async function openExport(page: Page) {
  await setUp(page, '#/Episode%2003', files);
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: 'Resolve / Premiere (.zip)' }).click();
}

// The files in a stored (uncompressed) zip, by name.
function unzip(bytes: Buffer): Record<string, Buffer> {
  const out: Record<string, Buffer> = {};
  const end = bytes.length - 22;
  let at = bytes.readUInt32LE(end + 16);
  for (let i = 0; i < bytes.readUInt16LE(end + 10); i++) {
    const size = bytes.readUInt32LE(at + 20);
    const nameLength = bytes.readUInt16LE(at + 28);
    const name = bytes.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    const local = bytes.readUInt32LE(at + 42);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    out[name] = bytes.subarray(start, start + size);
    at += 46 + nameLength + bytes.readUInt16LE(at + 30) + bytes.readUInt16LE(at + 32);
  }
  return out;
}

test('the preview shows the tracks, what the zip holds and how to open it; the settings change it', async ({ page }) => {
  await openExport(page);
  const preview = page.getByRole('region', { name: 'Preview' });
  await expect(preview.getByText('How Photosynthesis Works.zip · 1920 × 1080 · 30 fps')).toBeVisible();
  await expect(preview.locator('.name')).toHaveText(['Sections', 'Marks', 'V1', 'A1']);
  await expect(preview.locator('.section')).toHaveText(['Intro', 'Inside the leaf', 'Wrap-up']);
  await expect(preview.locator('.pin')).toHaveCount(5);
  await expect(preview.locator('.clip.take')).toHaveCount(5);
  await expect(preview.getByTitle(/^row-2-collage\.png/)).toBeVisible();
  await expect(preview.locator('.list')).toContainText('row-2-collage.png (made side by side)');
  // The five takes fold to first ↓ last (#255); a click shows them all, another folds them again. Two cards don't fold.
  const takes = preview.getByRole('button', { name: /^take-1\.wav/ });
  await expect(takes).toHaveAttribute('aria-expanded', 'false');
  await expect(takes.locator('.line')).toHaveText(['take-1.wav', '↓ 5 files', 'take-5.wav (from the .webm takes)']);
  await takes.click();
  await expect(takes).toHaveAttribute('aria-expanded', 'true');
  await expect(takes.locator('.line')).toHaveText([1, 2, 3, 4, 5].map((n) => `take-${n}.wav (from the .webm take)`));
  await takes.click();
  await expect(takes.locator('.line')).toHaveCount(3);
  await expect(preview.locator('.list > li')).toContainText(['card-row-3.png', 'card-row-5.png']);
  await expect(preview.getByText("Row 3's link (Chloroplast zoom animation) isn't in the zip")).toBeVisible();
  await expect(preview.getByText('Resolve: unzip, then File › Import › Timeline…')).toHaveClass(/help/);

  await page.getByLabel('Each picture on its own track').check();
  await expect(preview.locator('.name')).toHaveText(['Sections', 'Marks', 'V2', 'V1', 'A1']);
  await expect(preview.locator('.list')).toContainText('icons-ingredients.png (from .svg)');
  await page.getByLabel('Dialogue as captions (.srt)').check();
  await page.getByLabel('A marker on each row, with its dialogue').uncheck();
  await expect(preview.locator('.name')).toHaveText(['V2', 'V1', 'A1', 'C1']);
  await expect(preview.locator('.list')).toContainText('How Photosynthesis Works.srt');
  await page.getByLabel('25').check();
  await expect(preview.getByText('· 25 fps ·')).toBeVisible();

  // Remembered for next time.
  await page.reload();
  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: 'Resolve / Premiere (.zip)' }).click();
  await expect(page.getByLabel('Each picture on its own track')).toBeChecked();
  await expect(page.getByLabel('25')).toBeChecked();
});

test('the preview zooms in and scrolls sideways in its box; names show only where they fit; marks stay inside (#254)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openExport(page);
  const preview = page.getByRole('region', { name: 'Preview' });
  const scroll = preview.locator('.scroll');
  await expect(preview.getByRole('button', { name: 'Zoom out' })).toBeDisabled();
  await expect(preview.getByText('1×', { exact: true })).toBeVisible();
  const box = (await scroll.boundingBox())!;
  expect(await scroll.evaluate((e) => e.scrollWidth - e.clientWidth)).toBe(0); // the whole script shows at 1×

  // Each pin is a thin line inside the box, whose hover gives the row and its time.
  await expect(preview.locator('.pin').first()).toHaveAttribute('title', 'Row 1 · Intro at 0:00');
  await expect(preview.locator('.section').nth(1)).toHaveAttribute('title', /^Inside the leaf · from row 3 at \d:\d\d$/);
  for (const pin of await preview.locator('.pin').all()) {
    const b = (await pin.boundingBox())!;
    expect(b.width).toBeLessThanOrEqual(2);
    expect(b.x).toBeGreaterThanOrEqual(box.x);
    expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width);
  }

  // Clips leave a gap between them; takes are solid, in turn lighter and darker.
  const clips = await preview.locator('.clip:not(.take)').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.right]));
  for (let i = 1; i < clips.length; i++) expect(clips[i][0] - clips[i - 1][1]).toBeGreaterThanOrEqual(0.5);
  const shades = await preview.locator('.clip.take').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundImage + ' ' + getComputedStyle(e).backgroundColor));
  expect(shades[0]).toBe('none rgb(214, 239, 226)');
  expect(shades[1]).toBe('none rgb(191, 227, 210)');

  // Zoomed in to 16×, the tracks scroll sideways inside the box (never the page) and the names show.
  const named = async () => (await preview.locator('.clip').allTextContents()).filter((t) => t).length;
  const before = await named();
  for (let i = 0; i < 4; i++) await preview.getByRole('button', { name: 'Zoom in' }).click();
  await expect(preview.getByText('16×', { exact: true })).toBeVisible();
  await expect(preview.getByRole('button', { name: 'Zoom in' })).toBeDisabled();
  expect(await scroll.evaluate((e) => e.scrollWidth / e.clientWidth)).toBeGreaterThan(15);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await named()).toBe(await preview.locator('.clip').count());
  expect(before).toBeLessThan(await named());
  await expect(preview.locator('.clip.take').first()).toHaveText('take-1');
});

test('Save .zip gives the XML, the media (takes as WAV, .svg as PNG, cards, the collage) and the captions', async ({ page }) => {
  await openExport(page);
  await page.getByLabel('Dialogue as captions (.srt)').check();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save .zip' }).click()]);
  expect(download.suggestedFilename()).toBe('How Photosynthesis Works.zip');
  const zip = unzip(readFileSync(await download.path()));
  expect(Object.keys(zip).sort()).toEqual([
    'How Photosynthesis Works.srt', 'How Photosynthesis Works.xml',
    'media/card-row-3.png', 'media/card-row-5.png', 'media/glucose-model.png', 'media/leaf-closeup.jpg', 'media/leaf-push-in.mp4',
    'media/row-2-collage.png', 'media/take-1.wav', 'media/take-2.wav', 'media/take-3.wav', 'media/take-4.wav', 'media/take-5.wav',
  ]);
  const xml = zip['How Photosynthesis Works.xml'].toString('utf8');
  expect(xml).toContain('<xmeml version="5">');
  expect(xml).toContain('<name>How Photosynthesis Works</name>');
  expect(xml.match(/<clipitem /g)).toHaveLength(6 + 5); // V1: leaf, push-in, collage (held), card 3, glucose, card 5; A1: five takes
  expect(xml).toContain('<value>300</value>'); // the 640 × 400 leaf scaled up to fit 1920 × 1080 (to 270% high, 300% wide: the smaller wins)
  expect(xml).toContain('<pathurl>media/take-1.wav</pathurl>');
  expect(xml).toContain('<marker><name>Row 3 · Inside the leaf</name>');
  expect(zip['media/take-1.wav'].subarray(0, 4).toString()).toBe('RIFF');
  expect(zip['media/row-2-collage.png'].subarray(1, 4).toString()).toBe('PNG');
  expect(zip['media/leaf-closeup.jpg'].equals(readFileSync(`${dir}/assets/leaf-closeup.jpg`))).toBe(true);
  expect(zip['How Photosynthesis Works.srt'].toString('utf8')).toMatch(/^1\n00:00:00,000 --> 00:00:03,\d{3}\nEvery leaf you have ever seen is running a tiny factory\.\n/);
});

test('a frame rate and size of your own: a box beside Custom, checked in the page, written in the XML, remembered (#217)', async ({ page }) => {
  await openExport(page);
  const preview = page.getByRole('region', { name: 'Preview' });
  await expect(page.getByLabel('Width')).toHaveCount(0); // only once Custom is picked
  await page.getByRole('group', { name: 'Frame size' }).getByLabel('Custom').check();
  await page.getByLabel('Width').fill('1080');
  await page.getByLabel('Height').fill('1350');
  await expect(page.getByText('4:5', { exact: true })).toBeVisible();
  await page.getByRole('group', { name: 'Frames per second' }).getByLabel('Custom').check();
  await page.getByLabel('Your own frame rate').fill('23.976');
  await expect(preview.getByText('How Photosynthesis Works.zip · 1080 × 1350 · 23.976 fps')).toBeVisible();

  // Out of range: said in the page, and Save waits.
  await page.getByLabel('Your own frame rate').fill('200');
  await expect(page.getByLabel('Your own frame rate')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', { name: 'Save .zip' })).toBeDisabled();
  await page.getByLabel('Your own frame rate').fill('12.5');
  await expect(page.getByText('Resolve and Premiere count whole frames: written as 13 fps.')).toBeVisible();
  await page.getByLabel('Your own frame rate').fill('23.976');
  await expect(page.getByRole('button', { name: 'Save .zip' })).toBeEnabled();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save .zip' }).click()]);
  const xml = unzip(readFileSync(await download.path()))['How Photosynthesis Works.xml'].toString('utf8');
  expect(xml).toContain('<rate><timebase>24</timebase><ntsc>TRUE</ntsc></rate><width>1080</width><height>1350</height>');

  await page.reload();
  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: 'Resolve / Premiere (.zip)' }).click();
  await expect(page.getByLabel('Width')).toHaveValue('1080');
  await expect(page.getByLabel('Your own frame rate')).toHaveValue('23.976');
});
