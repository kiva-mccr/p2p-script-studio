import { expect, test, type Page } from './base';
import { readFileSync } from 'node:fs';
import { readFile, setUp, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

// The microphone is faked: a "recording" is half a second of silence as a real WAV, so it can be played back.
async function openExample(page: Page) {
  await page.addInitScript(() => {
    const wav = () => {
      const rate = 8000, n = rate / 2, buf = new DataView(new ArrayBuffer(44 + n * 2));
      const text = (at: number, s: string) => [...s].forEach((c, i) => buf.setUint8(at + i, c.charCodeAt(0)));
      text(0, 'RIFF'); buf.setUint32(4, 36 + n * 2, true); text(8, 'WAVEfmt '); buf.setUint32(16, 16, true);
      buf.setUint16(20, 1, true); buf.setUint16(22, 1, true); buf.setUint32(24, rate, true); buf.setUint32(28, rate * 2, true);
      buf.setUint16(32, 2, true); buf.setUint16(34, 16, true); text(36, 'data'); buf.setUint32(40, n * 2, true);
      return new Blob([buf], { type: 'audio/wav' });
    };
    (window as unknown as { studioRecord: () => Promise<{ stop: () => Promise<Blob> }> }).studioRecord = async () => ({
      stop: async () => wav(),
    });
  });
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

test('record a take for a row, see its length and words a minute, and play it back', async ({ page }) => {
  await openExample(page);
  await expect(page.getByRole('button', { name: 'Record row 1', exact: true })).not.toHaveAttribute('title'); // no hover text over the line
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Recording' })).toContainText('● Recording 0:0');
  await expect(page.getByRole('button', { name: 'Stop recording row 1' })).not.toHaveAttribute('title');
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  await expect(page.getByRole('button', { name: 'Play row 1' })).toContainText(/▶ 0:0\d/);
  await expect(page.locator('.take .about')).toContainText(/\d+ wpm · Sam, \w{3} \d+/);
  await expect(page.getByRole('button', { name: 'Record row 1 again' })).not.toHaveAttribute('title');
  await expect(page.locator('header .voice')).toHaveText(/^0:0\d\/0:\d\d$/);
  const take = JSON.parse(await readFile(page, 'Episode 03/voice/row-k3f9a.json'));
  expect(take).toMatchObject({ by: 'Sam', text: expect.stringContaining('Every leaf') });
  expect((await readFile(page, 'Episode 03/voice/row-k3f9a.webm')).startsWith('RIFF')).toBe(true);
  await page.getByRole('button', { name: 'Play row 1' }).click();
  await expect(page.getByRole('button', { name: 'Pause row 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play row 1' })).toBeVisible({ timeout: 5000 }); // played to the end
});

test('a take clicked twice while it loads plays once, and its bar only moves forward (#265)', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  const play = page.getByRole('button', { name: /^(Play|Pause) row 1$/ });
  await expect(play).toContainText('▶');
  // Two clicks before the first has loaded its sound: before #265, both loads played and both kept moving the bar.
  // The first click's file comes slower than the second's, as on a busy network drive.
  await page.evaluate(() => {
    const read = Blob.prototype.arrayBuffer;
    let calls = 0;
    Blob.prototype.arrayBuffer = function () {
      const slow = calls++ === 0;
      return read.call(this).then((data) => new Promise((done) => setTimeout(() => done(data), slow ? 150 : 0)));
    };
  });
  await play.dblclick();
  await expect(play).toContainText('❚❚');
  // Watch the bar every frame until the take ends: it must never step back.
  const widths = await page.evaluate(() => new Promise<number[]>((done) => {
    const seen: number[] = [];
    const look = () => {
      const bar = document.querySelector<HTMLElement>('[data-row] .take .bar > span');
      const button = document.querySelector('[data-row] .take .play');
      seen.push(parseFloat(bar?.style.width || '0'));
      if (button?.textContent?.includes('▶')) done(seen);
      else requestAnimationFrame(look);
    };
    look();
  }));
  while (widths.length && widths.at(-1) === 0) widths.pop(); // back to empty once it has ended
  const back = widths.filter((w, i) => i > 0 && w < widths[i - 1]);
  expect(back, `bar widths: ${widths.join(' ')}`).toEqual([]);
  expect(Math.max(...widths)).toBeGreaterThan(50);
});

test('a take says Outdated once its line is changed, and keeps its words a minute', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  await expect(page.locator('.take')).toBeVisible();
  await expect(page.locator('.old')).toHaveCount(0);
  const rate = await page.locator('.take .about').textContent();
  await page.getByLabel('Dialogue, row 1').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Really, really, truly it does.');
  await expect(page.locator('.old')).toContainText('Outdated');
  await expect(page.locator('.take .about')).toHaveText(rate!); // the words a minute of what was recorded
});

test('Outdated can be dismissed: the take keeps the line as it now reads, and the next edit shows it again', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  const rate = await page.locator('.take .about').textContent();
  await page.getByLabel('Dialogue, row 1').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Really, really, truly it does.');
  await expect(page.locator('.old')).toContainText('Outdated');
  await expect(page.locator('.take .about')).toHaveText(rate!);
  await page.getByRole('button', { name: "Row 1's take matches the line: hide Outdated" }).click();
  await expect(page.locator('.old')).toHaveCount(0);
  await expect(page.locator('.take .about')).not.toHaveText(rate!); // now counts the new words
  const take = JSON.parse(await readFile(page, 'Episode 03/voice/row-k3f9a.json'));
  expect(take.text).toContain('Really, really, truly it does.');
  expect(take.by).toBe('Sam');
  await page.getByLabel('Dialogue, row 1').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' More.');
  await expect(page.locator('.old')).toContainText('Outdated');
});

test('deleting a take takes it out of the folder; someone else’s take appears', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('takes-every', '1000')); // others' takes every 30 s (PF-8)
  await openExample(page);
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  await page.getByRole('button', { name: 'Delete the take of row 1' }).click();
  await expect(page.locator('.take')).toHaveCount(0);
  await expect(page.locator('header .voice')).toHaveText('0:25'); // only the read time, with no take
  await writeFile(page, 'Episode 03/voice/row-p8x2m.json', JSON.stringify({ by: 'Alex', at: Date.now(), seconds: 4, text: 'x' }));
  await expect(page.locator('header .voice')).toHaveText('0:04/0:25', { timeout: 10000 }); // 4 s for row 2's 10 words (4 s at 150)
  await expect(page.getByRole('button', { name: 'Record row 2 again' })).toBeVisible();
});

test('a deleted take comes back with Undo, and a take recorded again can be undone to keep the old one (UX-1, UX-2)', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  await expect(page.locator('.take')).toHaveCount(1); // written
  const first = await readFile(page, 'Episode 03/voice/row-k3f9a.json');
  const sound = (await readFile(page, 'Episode 03/voice/row-k3f9a.webm')).length;
  await page.getByRole('button', { name: 'Delete the take of row 1' }).click();
  await expect(page.locator('.take')).toHaveCount(0);
  await expect(page.locator('.toasts')).toContainText('Take of row 1 deleted.');
  await page.locator('.toasts').getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('.take')).toHaveCount(1);
  expect(await readFile(page, 'Episode 03/voice/row-k3f9a.json')).toBe(first);
  expect((await readFile(page, 'Episode 03/voice/row-k3f9a.webm')).length).toBe(sound);

  await page.waitForTimeout(20); // a new take has a later time
  await page.getByRole('button', { name: 'Record row 1 again' }).click();
  await page.getByRole('button', { name: 'Stop recording row 1' }).click();
  await expect(page.locator('.toasts')).toContainText('New take for row 1 saved.');
  await expect.poll(() => readFile(page, 'Episode 03/voice/row-k3f9a.json')).not.toBe(first);
  await page.getByRole('button', { name: 'Undo, keep the old take' }).click();
  await expect.poll(() => readFile(page, 'Episode 03/voice/row-k3f9a.json')).toBe(first);
  await expect(page.locator('.toasts')).toBeEmpty();
});

test('a blocked microphone says what to do, in the page', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { studioRecord: () => Promise<never> }).studioRecord = async () => {
      throw new DOMException('denied', 'NotAllowedError');
    };
  });
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await page.getByRole('button', { name: 'Record row 1', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The microphone is blocked or missing');
});

test('Export > Voice-over joins the takes in row order into one WAV, and says which rows have none', async ({ page }) => {
  await openExample(page);
  for (const row of [3, 1]) {
    await page.getByRole('button', { name: `Record row ${row}`, exact: true }).click();
    await page.getByRole('button', { name: `Stop recording row ${row}` }).click();
    await expect(page.getByRole('button', { name: `Record row ${row} again` })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('button', { name: 'Voice-over (.mp3, .wav)' }).click();
  await expect(page.getByLabel('Preview')).toContainText('2 of 5 rows have a take; the other 3 are left out.');
  await page.getByLabel('.wav (full quality, bigger)').check();
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save .wav' }).click()]);
  expect(file.suggestedFilename()).toBe('How Photosynthesis Works voice-over.wav');
  const bytes = readFileSync(await file.path());
  expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
  expect(bytes.readUInt32LE(24)).toBe(48000);
  expect(bytes.length).toBe(44 + 2 * 24000 * 2); // two takes of half a second, mono, 16 bits
});

test('Export > Voice-over: a pause between takes, silence for rows with none, and a row plays from its place', async ({ page }) => {
  await openExample(page);
  for (const row of [3, 1]) {
    await page.getByRole('button', { name: `Record row ${row}`, exact: true }).click();
    await page.getByRole('button', { name: `Stop recording row ${row}` }).click();
    await expect(page.getByRole('button', { name: `Record row ${row} again` })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('button', { name: 'Voice-over (.mp3, .wav)' }).click();
  await page.getByLabel('.wav (full quality, bigger)').check();
  await page.getByLabel('Half a second between takes').check();
  await expect(page.getByLabel('Preview').locator('.pause')).toHaveCount(1);
  let [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save .wav' }).click()]);
  expect(readFileSync(await file.path()).length).toBe(44 + 3 * 24000 * 2); // two takes and the pause between
  await page.getByLabel('Half a second between takes').uncheck();
  await page.getByLabel('Silence for rows with no take').check();
  await expect(page.getByLabel('Preview')).toContainText('the other 3 are silent for their read time');
  await expect(page.getByLabel('Preview').locator('.row.silent')).toHaveCount(3);
  [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save .wav' }).click()]);
  expect(readFileSync(await file.path()).length).toBeGreaterThan(44 + 2 * 24000 * 2 + 48000 * 2);
  // Row 3's take starts after row 1's take and row 2's read time.
  await page.getByLabel('Preview').locator('li').nth(2).getByRole('button').click();
  const at = await page.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime);
  expect(at).toBeGreaterThan(0.5);
});

test('Export > Voice-over with no takes says so and saves nothing', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('button', { name: 'Voice-over (.mp3, .wav)' }).click();
  await expect(page.getByRole('alert')).toContainText('No voice-over has been recorded yet');
  await expect(page.getByRole('button', { name: 'Save .mp3' })).toBeDisabled();
});

test('Export > Voice-over saves an .mp3 by default, and remembers .wav when picked (#237)', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Record row 2', exact: true }).click();
  await page.getByRole('button', { name: 'Stop recording row 2' }).click();
  await expect(page.getByRole('button', { name: 'Record row 2 again' })).toBeVisible();
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('button', { name: 'Voice-over (.mp3, .wav)' }).click();
  await expect(page.getByLabel('.mp3 (about a tenth the size)')).toBeChecked();
  await expect(page.getByLabel('Preview')).toContainText(/voice-over\.mp3 · 48 kHz mono · 128 kbps · \d+ KB/);
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Save .mp3' }).click()]);
  expect(file.suggestedFilename()).toBe('How Photosynthesis Works voice-over.mp3');
  const bytes = readFileSync(await file.path());
  expect(bytes[0]).toBe(0xff);
  expect(bytes[1] & 0xfe).toBe(0xfa); // MPEG-1 layer III
  // Half a second at 128 kbps is 8,000 bytes, plus LAME's frames at the ends.
  expect(bytes.length).toBeGreaterThan(7000);
  expect(bytes.length).toBeLessThan(12000);
  // It decodes as sound half a second long.
  const seconds = await page.evaluate(async (data) => (await new OfflineAudioContext(1, 1, 48000).decodeAudioData(new Uint8Array(data).buffer)).duration, [...bytes]);
  expect(seconds).toBeGreaterThan(0.45);
  expect(seconds).toBeLessThan(0.6);
  await page.getByLabel('.wav (full quality, bigger)').check();
  await page.getByRole('button', { name: 'Back to the script' }).click();
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('button', { name: 'Voice-over (.mp3, .wav)' }).click();
  await expect(page.getByLabel('.wav (full quality, bigger)')).toBeChecked();
  await expect(page.getByRole('button', { name: 'Save .wav' })).toBeEnabled();
});

test('Export > Voice-over shows each take\'s waveform and lights the row being heard (#237)', async ({ page }) => {
  await openExample(page);
  for (const row of [3, 1]) {
    await page.getByRole('button', { name: `Record row ${row}`, exact: true }).click();
    await page.getByRole('button', { name: `Stop recording row ${row}` }).click();
    await expect(page.getByRole('button', { name: `Record row ${row} again` })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('button', { name: 'Voice-over (.mp3, .wav)' }).click();
  const rows = page.getByLabel('Preview').locator('li');
  await expect(rows).toHaveCount(5);
  // A take's waveform is bars; a row with no take is a flat line.
  await expect(rows.nth(0).locator('.wave path')).toHaveAttribute('d', /^M[\d.]+ [\d.]+V/);
  await expect(rows.nth(1).locator('.wave path')).toHaveAttribute('d', 'M0 20H100');
  await expect(page.getByLabel('Preview').locator('li.lit')).toHaveCount(0);
  await rows.nth(2).getByRole('button').click();
  await expect(rows.nth(2)).toHaveClass(/lit/);
  await expect(rows.nth(2).locator('.wave .played')).toBeVisible();
  await expect(page.getByLabel('Preview').locator('li.lit')).toHaveCount(1);
  await rows.nth(0).getByRole('button').click();
  await expect(rows.nth(0)).toHaveClass(/lit/);
  await expect(rows.nth(2)).not.toHaveClass(/lit/);
});
