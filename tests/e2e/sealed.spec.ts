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
    await expect(page.getByRole('button', { name: 'Open the example' })).toHaveCount(0); // no private storage for a file

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
