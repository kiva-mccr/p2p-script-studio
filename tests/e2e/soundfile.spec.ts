import { expect, test, type Page } from './base';
import { readFileSync } from 'node:fs';
import { readFile, setUp } from './folder';

// #228 (board 85): a sound file picked under a row's mic becomes that row's take, like a recording.
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

// A WAV: `quiet` seconds of silence, then `loud` seconds of a tone, then `quiet` again (so the clean-up crops it).
function wav(quiet: number, loud: number): Buffer {
  const rate = 8000, n = Math.round(rate * (quiet * 2 + loud));
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const on = t >= quiet && t < quiet + loud;
    buf.writeInt16LE(on ? Math.round(Math.sin(2 * Math.PI * 440 * t) * 8000) : 0, 44 + i * 2);
  }
  return buf;
}

async function open(page: Page) {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

test('a sound file under the mic becomes the row’s take, measured and named like a recording', async ({ page }) => {
  await open(page);
  const button = page.getByRole('button', { name: 'Use a sound file for row 2' });
  await page.getByLabel('Dialogue, row 4').hover();
  await expect(button).toHaveCSS('opacity', '0'); // seen only on the row's hover
  await page.getByLabel('Dialogue, row 2').hover();
  await expect(button).toHaveCSS('opacity', '1');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button.click()]);
  await chooser.setFiles({ name: 'narration-row2.wav', mimeType: 'audio/wav', buffer: wav(1, 2) });
  await expect(page.getByRole('button', { name: 'Record row 2 again' })).toBeVisible();
  await expect(page.locator('.take .about')).toContainText(/\d+ wpm · from narration-row2\.wav · Sam, \w{3} \d+/);
  // Cropped as a recording is: 4 s in the file, the tone and a quarter second each side play.
  await expect(page.getByRole('button', { name: 'Play row 2' })).toContainText('▶ 0:03');
  const take = JSON.parse(await readFile(page, 'Episode 03/voice/row-p8x2m.json'));
  expect(take).toMatchObject({ by: 'Sam', seconds: 4, file: 'narration-row2.wav', text: expect.any(String) });
  expect(take.from).toBeCloseTo(0.75, 1);
  expect(take.to).toBeCloseTo(3.25, 1);
  // It plays.
  await page.getByRole('button', { name: 'Play row 2' }).click();
  await expect(page.getByRole('button', { name: 'Pause row 2' })).toBeVisible();
});

test('a sound file over a take can be undone to keep the old one; a file that isn’t sound says so', async ({ page }) => {
  await open(page);
  const pick = async (name: string, buffer: Buffer) => {
    await page.getByLabel('Dialogue, row 2').hover();
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Use a sound file for row 2' }).click()]);
    await chooser.setFiles({ name, mimeType: 'audio/wav', buffer });
  };
  await pick('first.wav', wav(0.5, 1));
  await expect(page.locator('.take .about')).toContainText('from first.wav');
  await pick('second.wav', wav(0.5, 2));
  await expect(page.locator('.take .about')).toContainText('from second.wav');
  await page.getByRole('button', { name: 'Undo, keep the old take' }).click();
  await expect(page.locator('.take .about')).toContainText('from first.wav');
  await expect.poll(async () => JSON.parse(await readFile(page, 'Episode 03/voice/row-p8x2m.json')).file).toBe('first.wav');

  await pick('notes.wav', Buffer.from('not a sound at all'));
  await expect(page.getByRole('alert')).toContainText("notes.wav couldn't be read as sound. Use a .wav, .mp3, .m4a or .webm file.");
  await expect(page.locator('.take .about')).toContainText('from first.wav');
});

test('an .mp3 works too: kept as it is, cropped to its tone', async ({ page }) => {
  await open(page);
  // tests/e2e/fixtures/tone.mp3: 1 s of silence, 1.5 s of a 440 Hz tone, 1 s of silence (made with ffmpeg).
  const mp3 = readFileSync('tests/e2e/fixtures/tone.mp3');
  await page.getByLabel('Dialogue, row 2').hover();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Use a sound file for row 2' }).click()]);
  await chooser.setFiles({ name: 'tone.mp3', mimeType: 'audio/mpeg', buffer: mp3 });
  await expect(page.locator('.take .about')).toContainText('from tone.mp3');
  await expect(page.getByRole('button', { name: 'Play row 2' })).toContainText('▶ 0:02');
  const take = JSON.parse(await readFile(page, 'Episode 03/voice/row-p8x2m.json'));
  expect(take.seconds).toBeGreaterThan(3.4);
  expect(take.from).toBeGreaterThan(0.6);
});
