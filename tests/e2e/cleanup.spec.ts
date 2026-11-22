import { expect, test, type Page } from './base';
import { readFileSync } from 'node:fs';
import { readFile, setUp, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

// The microphone is faked (AU-4): a "recording" is a real WAV of 0.3 s silence, 0.4 s of tone, 0.3 s silence, so the
// crop has something to find. Whether the browser's noise reduction was asked for is noted in window.noise.
async function open(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const wav = () => {
      const rate = 8000, n = rate, buf = new DataView(new ArrayBuffer(44 + n * 2));
      const text = (at: number, s: string) => [...s].forEach((c, i) => buf.setUint8(at + i, c.charCodeAt(0)));
      text(0, 'RIFF'); buf.setUint32(4, 36 + n * 2, true); text(8, 'WAVEfmt '); buf.setUint32(16, 16, true);
      buf.setUint16(20, 1, true); buf.setUint16(22, 1, true); buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true);
      buf.setUint16(32, 2, true); buf.setUint16(34, 16, true); text(36, 'data'); buf.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i++) buf.setInt16(44 + i * 2, i > 0.3 * rate && i < 0.7 * rate ? Math.round(8000 * Math.sin(i / 3)) : 0, true);
      return new Blob([buf], { type: 'audio/wav' });
    };
    w.level = -18; // the live level the fake mic reports, in dBFS (AU-11)
    w.studioRecord = async (_mic: string, noise: boolean) => {
      w.noise = noise;
      w.stops = 0;
      return { stop: async () => ((w.stops = 1), wav()), level: () => w.level as number };
    };
  });
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

async function settings(page: Page) {
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  return page.getByRole('dialog', { name: 'Settings' });
}

test('the mic records at once, a ring fills for a second, then ■ is the cue; the take is cropped', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Getting ready…' })).toBeVisible();
  await expect(page.locator('.mic.cue .ring')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '● Recording' })).toBeVisible({ timeout: 3000 });
  await expect(page.locator('.mic.cue')).toHaveCount(0);
  await expect(page.locator('.mic.on')).toHaveText('■');
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  await expect(page.getByRole('button', { name: 'Play row 1' })).toBeVisible();
  const take = JSON.parse(await readFile(page, 'Episode 03/voice/row-k3f9a.json'));
  expect(take.from).toBeCloseTo(0.05, 1);
  expect(take.to).toBeCloseTo(0.95, 1);
  expect(take.gain).toBeGreaterThan(0);
  expect(take.ride.length).toBeGreaterThan(0); // AU-11: the level inside the take, a step every half second
  expect(take.seconds).toBeGreaterThan(1.2); // the whole recording, as timed
  await expect(page.getByRole('button', { name: 'Play row 1' })).toHaveText('▶ 0:01');
  // The crop is the take's timed length less the part kept: the timing grows when the machine is busy (seen at 1 s).
  const cut = Math.round((take.seconds - (take.to - take.from)) * 10) / 10;
  await expect(page.getByRole('button', { name: 'Play row 1' })).toHaveAttribute('title', `0:01 after cropping ${cut} s of silence`);
  expect(await page.evaluate(() => (window as unknown as { noise: boolean }).noise)).toBe(true);
  // It plays (the cropped part) to the end.
  await page.getByRole('button', { name: 'Play row 1' }).click();
  await expect(page.getByRole('button', { name: 'Pause row 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play row 1' })).toBeVisible({ timeout: 5000 });
});

test('Esc while the ring fills throws the new take away and keeps the old one', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('takes-every', '1000')); // others' takes every 30 s (PF-8)
  await open(page);
  await writeFile(page, 'Episode 03/voice/row-k3f9a.json', JSON.stringify({ by: 'Alex', at: Date.now(), seconds: 4, text: 'x' }));
  await expect(page.getByRole('button', { name: 'Record row 1 again' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Record row 1 again' }).click();
  await expect(page.locator('.mic.cue')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('status').filter({ hasText: /Getting ready|Recording/ })).toHaveCount(0);
  await page.waitForTimeout(1200);
  await expect(page.getByRole('status').filter({ hasText: 'Recording' })).toHaveCount(0);
  expect(JSON.parse(await readFile(page, 'Episode 03/voice/row-k3f9a.json')).by).toBe('Alex');
  await expect(page.locator('.take .about')).toContainText('Alex');
});

test('Settings switches the clean-up: crop off plays the whole take, noise reduction off records without it', async ({ page }) => {
  await open(page);
  const dialog = await settings(page);
  const crop = dialog.getByLabel('Crop the silence at the start and end');
  const noise = dialog.getByLabel('Reduce background noise');
  const level = dialog.getByLabel('Even out the loudness');
  await expect(crop).toBeChecked();
  await expect(noise).toBeChecked();
  await expect(level).toBeChecked();
  await noise.uncheck();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await expect(page.locator('.mic.on')).toBeVisible({ timeout: 3000 });
  await page.waitForTimeout(1100);
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  expect(await page.evaluate(() => (window as unknown as { noise: boolean }).noise)).toBe(false);
  await expect(page.getByRole('button', { name: 'Play row 1' })).toHaveText('▶ 0:01');
  await (await settings(page)).getByLabel('Crop the silence at the start and end').uncheck();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: 'Play row 1' })).toHaveText(/^▶ 0:0[23]$/); // the whole take, as timed
  await expect(page.getByRole('button', { name: 'Play row 1' })).not.toHaveAttribute('title', /.+/);
  // Kept in this browser.
  await page.reload();
  const again = await settings(page);
  await expect(again.getByLabel('Crop the silence at the start and end')).not.toBeChecked();
  await expect(again.getByLabel('Reduce background noise')).not.toBeChecked();
  await expect(again.getByLabel('Even out the loudness')).toBeChecked();
});

test('a live level shows beside Recording: green when good, red when too loud, no words (AU-11)', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await expect(page.getByRole('meter', { name: 'Microphone level' })).toHaveCount(0); // not while the ring fills
  const meter = page.getByRole('meter', { name: 'Microphone level' });
  await expect(meter).toBeVisible({ timeout: 3000 });
  await expect(meter).toHaveAttribute('aria-valuenow', '70'); // -18 dBFS on a bar from -60 to 0
  await expect(meter).toHaveClass(/good/);
  await page.evaluate(() => ((window as unknown as { level: number }).level = -2));
  await expect(meter).toHaveClass(/loud/);
  await page.evaluate(() => ((window as unknown as { level: number }).level = -45));
  await expect(meter).toHaveClass(/quiet/);
  await expect(page.locator('.take.rec')).not.toContainText(/quiet|loud/i);
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  await expect(meter).toHaveCount(0);
});

test('a take recorded before AU-11 is measured again on open, so it evens out too', async ({ page }) => {
  // A WAV of 1 s: 0.3 s silence, 0.4 s tone, 0.3 s silence, saved as the take with an AU-4 note (no ride).
  const rate = 8000, n = rate, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(i > 0.3 * rate && i < 0.7 * rate ? Math.round(8000 * Math.sin(i / 3)) : 0, 44 + i * 2);
  const old = { by: 'Alex', at: 1700000000000, seconds: 1, text: 'x', from: 0.05, to: 0.95, gain: 1.3, words: [['x', 0.3]] };
  await setUp(page, '#/Episode%2003', {
    'Episode 03/script.md': example,
    'Episode 03/voice/row-k3f9a.webm': 'base64:' + buf.toString('base64'),
    'Episode 03/voice/row-k3f9a.json': JSON.stringify(old),
  });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await expect.poll(async () => JSON.parse(await readFile(page, 'Episode 03/voice/row-k3f9a.json')).ride?.length ?? 0, { timeout: 10000 }).toBeGreaterThan(0);
  const take = JSON.parse(await readFile(page, 'Episode 03/voice/row-k3f9a.json'));
  // Who, when, the text and the heard words are kept; the crop is measured the same way.
  expect(take).toMatchObject({ by: 'Alex', at: old.at, text: 'x', words: old.words });
  expect(take.from).toBeCloseTo(0.05, 1);
});
