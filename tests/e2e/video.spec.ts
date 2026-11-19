import { expect, test, type Page } from './base';
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
  await expect(page.getByLabel('Dialogue, row 1', { exact: true })).toBeVisible();
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

test('each clip shows a tiny picture of itself; a placeholder a grey card (#220)', async ({ page }) => {
  await openVideo(page);
  const clips = page.getByRole('region', { name: 'Preview' }).locator('.clip');
  await expect(clips).toHaveCount(6);
  // The leaf (a photo), the push-in (a video's first frame) and the collage (its first picture) get theirs.
  for (const i of [0, 1, 2, 4]) {
    await expect(clips.nth(i).locator('img.thumb')).toHaveJSProperty('complete', true);
    expect(await clips.nth(i).locator('img.thumb').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  }
  await expect(clips.nth(3).locator('.thumb.grey')).toHaveCount(1); // row 3's card: no picture of its own
  await expect(clips.nth(2)).toHaveText('Collage');
});

test("a row's card says what's still to find or film, unless the box is unticked (#227)", async ({ page }) => {
  await openVideo(page);
  const preview = page.getByRole('region', { name: 'Preview' });
  const box = page.getByLabel("Say what's still to find on placeholders");
  await expect(box).toBeChecked(); // on by default
  await preview.locator('.clip').nth(5).click(); // row 5's card: "Park b-roll of a deep breath (to film)" in its Files
  const canvas = preview.locator('canvas');
  const drawn = () => canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL());
  // Grey words under the card's own: the card's lower part has dark pixels only while the box is ticked.
  const lowerInk = () => canvas.evaluate((c: HTMLCanvasElement) => {
    const { data } = c.getContext('2d')!.getImageData(0, Math.round(c.height * 0.6), c.width, Math.round(c.height * 0.35));
    let ink = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] < 160) ink++;
    return ink;
  });
  await expect.poll(lowerInk).toBeGreaterThan(50);
  const withList = await drawn();
  await box.uncheck();
  await expect.poll(drawn).not.toBe(withList);
  await expect.poll(lowerInk).toBe(0);

  await page.reload();
  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: 'Video (.mp4)' }).click();
  await expect(box).not.toBeChecked();
});

test('very many clips stay inside the row and the page; narrow ones drop their picture (#220)', async ({ page }) => {
  const many = Array.from({ length: 400 }, (_, i) => `## ${i + 1} <!-- id: m${String(i).padStart(4, '0')} -->\nDialogue:\nWord.\n\nFiles:\n- assets/leaf-closeup.jpg\n`).join('\n');
  await openVideo(page, { 'Episode 03/script.md': `---\ntitle: Many\n---\n\n${many}` });
  const preview = page.getByRole('region', { name: 'Preview' });
  await expect(preview.locator('.clip')).toHaveCount(400);
  const row = preview.locator('.clips');
  const box = (await row.boundingBox())!;
  for (const i of [0, 199, 399]) {
    const clip = (await preview.locator('.clip').nth(i).boundingBox())!;
    expect(clip.x).toBeGreaterThanOrEqual(box.x - 0.5);
    expect(clip.x + clip.width).toBeLessThanOrEqual(box.x + box.width + 4); // at most its own border past the end, clipped
    expect(clip.height).toBeLessThanOrEqual(box.height);
  }
  await expect(preview.locator('.clip img.thumb').first()).toBeAttached();
  await expect(preview.locator('.clip img.thumb').first()).toBeHidden(); // a sliver: no room for the picture
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(await row.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
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

test('a size and rate of your own (#217): the preview takes its shape, and the video is made at them', async ({ page }) => {
  test.setTimeout(90_000);
  await openVideo(page);
  const preview = page.getByRole('region', { name: 'Preview' });
  await expect(page.getByText('Wide, as set on the timeline at the bottom of Write.')).toBeVisible();
  await page.getByRole('group', { name: 'Frame size' }).getByLabel('Custom').check();
  await expect(page.getByText('Wide, as set on the timeline at the bottom of Write.')).toHaveCount(0); // your own size wins
  await page.getByLabel('Width').fill('9');
  await expect(page.getByText('16 to 8192 pixels')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save video' })).toBeDisabled();
  await page.getByLabel('Width').fill('480');
  await page.getByLabel('Height').fill('600');
  await page.getByRole('group', { name: 'Frames per second' }).getByLabel('Custom').check();
  await page.getByLabel('Your own frame rate').fill('12');
  await expect(preview.getByText(/· 480 × 600 · 12 fps ·/)).toBeVisible();
  const box = (await preview.locator('.screen').boundingBox())!;
  expect(box.width / box.height).toBeCloseTo(0.8, 1);

  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 80_000 }), page.getByRole('button', { name: 'Save video' }).click()]);
  const input = new Input({ source: new BufferSource(readFileSync(await download.path())), formats: ALL_FORMATS });
  const picture = (await input.getPrimaryVideoTrack())!;
  expect(picture.displayWidth).toBe(480);
  expect(picture.displayHeight).toBe(600);
  expect((await picture.computePacketStats()).averagePacketRate).toBeCloseTo(12, 0);
});

test('the timeline turns upright: its preview, the script and the video follow', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.getByRole('button', { name: /^Timeline/ }).click(); // unfold the drawer (SB-4)
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
  await expect(page.getByText('Upright, as set on the timeline at the bottom of Write.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to the script' }).click();

  // Back to wide: the line goes.
  await page.getByRole('group', { name: 'Video shape' }).getByRole('button', { name: 'Wide' }).click();
  await expect.poll(() => readFile(page, 'Episode 03/script.md')).not.toContain('shape:');
});
