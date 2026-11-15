import { expect, test, type Page } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import { ALL_FORMATS, BufferSource, Input } from 'mediabunny';
import { readFile, setUp } from './folder';

// The storyboard timeline as a video (SB-3, board 70). The example with its pictures and real takes (a made-up
// voice), row 2 as a collage with a hold after it.
const dir = 'docs/example/Episode 03 - How Photosynthesis Works';
const script = readFileSync(`${dir}/script.md`, 'utf8').replace('- assets/music-bed.mp3\n', '- assets/music-bed.mp3\n- assets/zoom-sketch.svg (timeline)\n\nTimeline: collage, then hold 2 s\n');
const files: Record<string, string> = { 'Episode 03/script.md': script };
for (const sub of ['assets', 'voice']) {
  for (const name of readdirSync(`${dir}/${sub}`)) files[`Episode 03/${sub}/${name}`] = 'base64:' + readFileSync(`${dir}/${sub}/${name}`).toString('base64');
}

async function openVideo(page: Page, more: Record<string, string> = {}) {
  await setUp(page, '#/Episode%2003', { ...files, ...more });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: 'Video (.mp4)' }).click();
}

// The total length shown in the preview's line, in seconds.
async function shownLength(page: Page): Promise<number> {
  const text = await page.getByRole('region', { name: 'Preview' }).locator('.caption').first().textContent();
  const [m, s] = text!.match(/· (\d+):(\d\d) ·/)!.slice(1).map(Number);
  return m * 60 + s;
}

test('the preview shows a moment of the video and its clips; the settings change it and are remembered', async ({ page }) => {
  await openVideo(page);
  const preview = page.getByRole('region', { name: 'Preview' });
  await expect(preview.getByText(/^How Photosynthesis Works\.mp4 · 1920 × 1080 · 30 fps · 0:\d\d · about \d+ MB$/)).toBeVisible();
  await expect(preview.locator('.clip')).toHaveCount(6); // leaf, push-in, collage (held), card 3, glucose, card 5
  await expect(preview.locator('.clip').nth(2)).toHaveText('Collage');
  await preview.locator('.clip').nth(2).click();
  await expect(preview.locator('.clip').nth(2)).toHaveAttribute('aria-pressed', 'true');
  await expect(preview.locator('canvas')).toBeVisible();
  await expect(preview.getByText('The same pictures and timings as the storyboard timeline')).toHaveClass(/help/);

  const full = await shownLength(page);
  await page.getByLabel('720p').check();
  await expect(preview.getByText('· 1280 × 720 ·')).toBeVisible();
  await page.getByLabel('Left out').check(); // no row lacks a take in the example: nothing changes
  expect(await shownLength(page)).toBe(full);
  await page.getByLabel('Dialogue as captions on the picture').check();

  await page.reload();
  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: 'Video (.mp4)' }).click();
  await expect(page.getByLabel('720p')).toBeChecked();
  await expect(page.getByLabel('Left out')).toBeChecked();
  await expect(page.getByLabel('Dialogue as captions on the picture')).toBeChecked();
});

test('rows with no take play silent for their read time, or are left out', async ({ page }) => {
  // Row 5's take is gone.
  const some = Object.fromEntries(Object.entries(files).filter(([path]) => !/voice\/row-[^/]*$/.test(path) || !path.includes(script.match(/## 5 <!-- id: (\w+)/)![1])));
  await setUp(page, '#/Episode%2003', some);
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: 'Video (.mp4)' }).click();
  const silent = await shownLength(page);
  await page.getByLabel('Left out').check();
  await expect.poll(() => shownLength(page)).toBeLessThan(silent);
});

test('Save video makes a video as long as the timeline, with sound, and plays it in the preview', async ({ page }) => {
  test.setTimeout(90_000);
  await openVideo(page);
  await page.getByLabel('720p').check();
  await page.getByLabel('Dialogue as captions on the picture').check();
  const length = await shownLength(page);
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 80_000 }), page.getByRole('button', { name: 'Save video' }).click()]);
  // MP4 where the browser can make H.264 (this test Chromium can, with no H.264 decoder to play it), else WebM.
  const mp4 = download.suggestedFilename() === 'How Photosynthesis Works.mp4';
  if (!mp4) expect(download.suggestedFilename()).toBe('How Photosynthesis Works.webm');
  const bytes = readFileSync(await download.path());
  if (mp4) expect(bytes.subarray(4, 8).toString()).toBe('ftyp');
  else {
    expect(bytes.subarray(0, 4).toString('hex')).toBe('1a45dfa3'); // WebM (Matroska)
    await expect(page.getByText("Saved as WebM: this browser can't make MP4 here.")).toBeVisible();
  }

  // Read back without playing it: the picture's size and length are the timeline's, and there is a sound track.
  const input = new Input({ source: new BufferSource(bytes), formats: ALL_FORMATS });
  const picture = (await input.getPrimaryVideoTrack())!;
  expect(picture.displayWidth).toBe(1280);
  expect(picture.displayHeight).toBe(720);
  expect(Math.abs((await input.computeDuration()) - length)).toBeLessThan(1.5);
  const sound = (await input.getPrimaryAudioTrack())!;
  expect(Math.abs((await sound.computeDuration()) - length)).toBeLessThan(1.5);
  expect(['aac', 'opus']).toContain(sound.codec);
  await expect(page.getByRole('region', { name: 'Preview' }).locator('video')).toBeVisible(); // the made video, ready to play
});

test('the timeline turns upright: its preview, the script and the video follow', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  const shape = page.getByRole('group', { name: 'Video shape' });
  await expect(shape.getByRole('button', { name: 'Wide' })).toHaveAttribute('aria-pressed', 'true');
  await shape.getByRole('button', { name: 'Upright' }).click();
  await expect(shape.getByRole('button', { name: 'Upright' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => readFile(page, 'Episode 03/script.md')).toContain('\nshape: upright\n');

  // Playing, the preview is upright and a collage stacks its pictures.
  await page.getByRole('region', { name: 'Timeline' }).locator('.blk.row').nth(1).click();
  await page.getByRole('button', { name: '▶ Play from here' }).click();
  const box = await page.locator('.preview .screen').boundingBox();
  expect(box!.height).toBeGreaterThan(box!.width);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: 'Video (.mp4)' }).click();
  await expect(page.getByRole('region', { name: 'Preview' }).getByText('· 1080 × 1920 ·')).toBeVisible();
  await expect(page.getByText('Upright, as set on the timeline under the script.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the script' }).click();

  // Back to wide: the line goes.
  await page.getByRole('group', { name: 'Video shape' }).getByRole('button', { name: 'Wide' }).click();
  await expect.poll(() => readFile(page, 'Episode 03/script.md')).not.toContain('shape:');
});
