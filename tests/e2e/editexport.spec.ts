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
  await expect(preview.locator('.name')).toHaveText(['Marks', 'V1', 'A1']);
  await expect(preview.locator('.mark')).toHaveText(['1 · Intro', '2', '3 · Inside the leaf', '4', '5 · Wrap-up']);
  await expect(preview.locator('.clip.take')).toHaveCount(5);
  await expect(preview.getByTitle(/^row-2-collage\.png/)).toBeVisible();
  await expect(preview.locator('.list')).toContainText('row-2-collage.png (made side by side)');
  await expect(preview.locator('.list')).toContainText('take-1.wav (from the .webm take)');
  await expect(preview.getByText("Row 3's link (Chloroplast zoom animation) isn't in the zip")).toBeVisible();
  await expect(preview.getByText('Resolve: unzip, then File › Import › Timeline…')).toHaveClass(/help/);

  await page.getByLabel('Each picture on its own track').check();
  await expect(preview.locator('.name')).toHaveText(['Marks', 'V2', 'V1', 'A1']);
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
