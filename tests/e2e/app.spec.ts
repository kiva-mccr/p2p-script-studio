import { expect, test } from './base';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');

test('opens on the script list', async ({ page }) => {
  await setUp(page);
  await expect(page.getByRole('heading', { name: 'No scripts here yet' })).toBeVisible();
});

test('a link opens the script it names, after set-up', async ({ page }) => {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf you have ever seen is running a tiny factory.');
});

test('the ? in the top bar has GitHub and the version; nothing sits in the corners (SB-5)', async ({ page }) => {
  await setUp(page);
  await expect(page.getByRole('link', { name: /GitHub/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Help and version' }).click();
  const menu = page.getByRole('menu', { name: 'Help and version' });
  await expect(menu.getByRole('menuitem', { name: 'GitHub ↗' })).toHaveAttribute('href', 'https://github.com/kiva-mccr/p2p-script-studio');
  // Not the live site's build, so the version says so (AP-28).
  await expect(menu.getByRole('menuitem', { name: 'Version: dev ↗' })).toHaveAttribute('href', 'https://github.com/kiva-mccr/p2p-script-studio');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});
