import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from './base';
import { policyOf, SEALED_FILE, unsealed } from '../../src/lib/sealedfile';

// The sealed app (SE-10): the website offers it on Download sealed, with what IT needs to check it, and the file opened
// from the computer works with no network address at all.
const built = fileURLToPath(new URL(`../../dist/${SEALED_FILE}`, import.meta.url));

test('Download sealed: the ? menu opens the page, with the file, its fingerprint and the checks', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Help and version' }).click();
  await page.getByRole('menuitem', { name: 'Download sealed' }).click();
  await expect(page.getByRole('heading', { name: 'Download the sealed app' })).toBeVisible();
  const sha256 = createHash('sha256').update(readFileSync(built)).digest('hex').toUpperCase();
  await expect(page.locator('code.hash')).toHaveText(sha256);
  await expect(page.getByRole('link', { name: 'VirusTotal ↗' })).toHaveAttribute('href', `https://www.virustotal.com/gui/file/${sha256.toLowerCase()}`);
  for (const check of ["It's the file we published", 'It was built from the public code', 'Its rules allow no address', 'Watch it', 'A malware scan'])
    await expect(page.getByRole('heading', { name: new RegExp(check) })).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('link', { name: 'Download the app' }).click()]);
  expect(download.suggestedFilename()).toBe(SEALED_FILE);
  expect(createHash('sha256').update(readFileSync(await download.path())).digest('hex').toUpperCase()).toBe(sha256);

  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByRole('heading', { name: 'Open your scripts folder' })).toBeVisible();
});

test('Download sealed: the app and the speech models, with the models\' fingerprint and attestation (SE-5)', async ({ page }) => {
  // The deploy writes speech-models.json (scripts/models.ts); a test build has no models, so it is made up here.
  const models = { tag: 'speech-models-b1e9b6a-608c49e', url: 'https://github.com/kiva-mccr/p2p-script-studio/releases/download/speech-models-b1e9b6a-608c49e/speech-models.zip', sha256: 'AB'.repeat(32), bytes: 330e6 };
  await page.route(/\/speech-models\.json$/, (route) => route.fulfill({ json: models }));
  await page.goto('./#download-sealed');
  await expect(page.getByRole('link', { name: 'Download the speech models' })).toHaveCount(0);
  await page.getByText('The app and the speech models').click();
  await expect(page.getByRole('link', { name: 'Download the app' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download the speech models' })).toHaveAttribute('href', models.url);
  await expect(page.getByText('models 330 MB')).toBeVisible();
  await expect(page.locator('code.hash').nth(1)).toHaveText(models.sha256);
  await expect(page.getByText('gh attestation verify speech-models.zip')).toBeVisible();
});

test.describe(() => {
  test.use({ refusalsExpected: true }); // the reach for a website below is meant to be refused

  test('the sealed file opens from the computer, asks nothing of any site, and its policy refuses one', async ({ page }) => {
    const elsewhere: string[] = [];
    page.on('request', (r) => !/^(file|blob|data):/.test(r.url()) && elsewhere.push(r.url()));
    const refused: string[] = [];
    page.on('console', (m) => /Content Security Policy/.test(m.text()) && refused.push(m.text()));
    await page.goto(`file://${built}`);
    await expect(page.getByRole('heading', { name: 'Open your scripts folder' })).toBeVisible();
    expect(unsealed(policyOf(readFileSync(built, 'utf8')))).toEqual([]);
    expect(await page.evaluate(() => isSecureContext && 'showDirectoryPicker' in window)).toBe(true); // the folder can be picked
    await expect(page.getByRole('button', { name: 'Open the example' })).toBeVisible(); // kept in IndexedDB (no private storage for a file)

    // The ? menu: no GitHub, no download, the version marked sealed.
    await page.getByRole('button', { name: 'Help and version' }).click();
    await expect(page.getByRole('menuitem', { name: /GitHub/ })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Download sealed' })).toHaveCount(0);
    await expect(page.getByText(/· sealed$/)).toBeVisible();

    expect(await page.evaluate(() => fetch('https://example.com/').then(() => 'reached', () => 'refused'))).toBe('refused');
    expect(refused.join('\n')).toMatch(/connect-src/);
    expect(elsewhere).toEqual([]);
  });
});

// The sealed file served from the test site instead of the computer: a folder can't be picked in headless tests, and the
// example and Settings are reached without one.
test('the sealed app keeps its example inside the browser, and its Settings take the speech models (SE-5)', async ({ page }) => {
  await page.goto(`./${SEALED_FILE}`);
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByText('How Photosynthesis Works').click();
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.getByLabel('Dialogue, row 1').fill('Plants make food from light.');
  await expect.poll(() => page.evaluate(async () => {
    const opfs: string[] = [];
    for await (const name of (await navigator.storage.getDirectory() as unknown as { keys(): AsyncIterable<string> }).keys()) opfs.push(name);
    const db = await new Promise<IDBDatabase>((r) => (indexedDB.open('script-studio-example').onsuccess = (e) => r((e.target as IDBOpenDBRequest).result)));
    const text = await new Promise<string>((r) => (db.transaction('files').objectStore('files').get('Example/Episode 03 - How Photosynthesis Works/script.md').onsuccess =
      (e) => (e.target as IDBRequest<{ blob: Blob }>).result.blob.text().then(r)));
    db.close();
    return { opfs, saved: text.includes('Plants make food from light.') };
  }), { timeout: 10000 }).toEqual({ opfs: [], saved: true }); // nothing in the browser's private storage, as if opened from disk

  await page.reload(); // it comes back as it was left
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Plants make food from light.');

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings.getByRole('heading', { name: 'Speech models' })).toBeVisible();
  await expect(settings.getByText('Not added.')).toBeVisible();
  await settings.locator('input[type="file"]').setInputFiles({ name: 'speech-models.zip', mimeType: 'application/zip', buffer: Buffer.from('not a zip') });
  await expect(settings.getByRole('alert')).toContainText("That file can't be used: it isn't a zip.");
  await expect(settings.getByText('Not added.')).toBeVisible();
  await settings.getByRole('button', { name: 'Done' }).click();

  // Start over and its Undo work on the browser's folder too.
  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.getByLabel('Dialogue, row 1')).not.toHaveValue('Plants make food from light.');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Plants make food from light.');
});
