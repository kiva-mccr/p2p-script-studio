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
  // GitHub's own mark, not ↗ (issue #232).
  const github = menu.getByRole('menuitem', { name: 'GitHub', exact: true });
  await expect(github).toHaveAttribute('href', 'https://github.com/kiva-mccr/p2p-script-studio');
  await expect(github.locator('svg')).toBeVisible();
  // Not the live site's build, so the version says so (AP-28).
  await expect(menu.getByRole('menuitem', { name: 'Version: dev ↗' })).toHaveAttribute('href', 'https://github.com/kiva-mccr/p2p-script-studio');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
});

test('the ? is on every screen: dimmer in a script, on Export and in the Teleprompter (issue #219)', async ({ page }) => {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  const q = page.getByRole('button', { name: 'Help and version' });
  await expect(q).toHaveCSS('color', 'rgb(95, 95, 95)'); // a touch dimmer than on the list
  await q.hover();
  await expect(q).toHaveCSS('color', 'rgb(42, 91, 215)');

  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: 'Fountain (.fountain)' }).click();
  await expect(page.getByRole('navigation', { name: 'Export as' })).toBeVisible();
  await page.getByRole('button', { name: 'Help and version' }).click();
  await expect(page.getByRole('menuitem', { name: 'Feedback…' })).toBeVisible();
  await page.getByRole('button', { name: 'Help and version' }).click();
  await page.getByRole('button', { name: 'Back to the script' }).click();

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Teleprompter' }).click();
  const prompter = page.getByRole('dialog', { name: 'Teleprompter' });
  await prompter.getByRole('button', { name: 'Help and version' }).click();
  const menu = prompter.getByRole('menu', { name: 'Help and version' });
  await expect(menu.getByRole('menuitem', { name: 'Feedback…' })).toBeVisible();
  // It opens upwards, above the controls at the bottom of the screen.
  const m = (await menu.boundingBox())!;
  const b = (await prompter.getByRole('button', { name: 'Help and version' }).boundingBox())!;
  expect(m.y + m.height).toBeLessThanOrEqual(b.y);
  await menu.getByRole('menuitem', { name: 'Feedback…' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Feedback:' })).toBeVisible(); // over the Teleprompter
});

test('See the example in the ? menu opens it from your folder, and leaving it comes back to your list (issue #239)', async ({ page }) => {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.getByRole('button', { name: 'Help and version' }).click();
  await page.getByRole('menuitem', { name: 'See the example' }).click();
  await expect(page.getByText('Example script.')).toBeVisible();
  await expect(page.getByText('How Photosynthesis Works')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  // Already in it: the menu leaves it out.
  await page.getByRole('button', { name: 'Help and version' }).click();
  await expect(page.getByRole('menuitem', { name: 'Feedback…' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'See the example' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open your scripts folder' }).click();
  await expect(page.getByText('Example script.')).toHaveCount(0);
  await expect(page.getByRole('banner').getByText('Video Scripts')).toBeVisible(); // your folder's list
});
