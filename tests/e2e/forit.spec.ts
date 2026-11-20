import { expect, test } from './base';
import { SEALED_FILE } from '../../src/lib/sealedfile';

// For IT (SE-8, board 93): one page for IT, from the ? menu, whose contents stay pinned and jump to each section.

test('For IT: the ? menu opens it, and its contents stay put, jump to a section and light the one being read', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./');
  await page.getByRole('button', { name: 'Help and version' }).click();
  await page.getByRole('menuitem', { name: 'For IT' }).click();
  await expect(page).toHaveURL(/#for-it$/);
  const nav = page.getByRole('navigation', { name: 'On this page' });
  await expect(nav.getByRole('button', { name: 'In short' })).toHaveAttribute('aria-current', 'location');
  await expect(page.getByRole('cell', { name: 'p2p-script-studio.kivamccr.xyz', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'IndexedDB script-studio-history' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Print or save as PDF' })).toBeVisible();
  // The ASVS table's Status column is the narrow one, its How column the wide one.
  const status = (await page.getByRole('columnheader', { name: 'Status' }).boundingBox())!;
  const how = (await page.getByRole('columnheader', { name: 'How' }).boundingBox())!;
  expect(status.width).toBeLessThan(how.width / 2);

  // A click jumps to the section and lights it; the contents are still in view, top left.
  await nav.getByRole('button', { name: 'Browser policies' }).click();
  const heading = page.getByRole('heading', { name: 'Browser policies IT can set' });
  await expect.poll(async () => Math.round((await heading.boundingBox())!.y)).toBeLessThan(60);
  await expect(nav.getByRole('button', { name: 'Browser policies' })).toHaveAttribute('aria-current', 'location');
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(500);
  const box = (await nav.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeLessThan(40);
  expect(box.x).toBeLessThan(200);

  // Scrolling by hand lights the section at the top.
  await page.waitForTimeout(900); // the click's smooth scroll keeps its entry lit for a moment
  await page.evaluate(() => document.getElementById('it-permissions')!.scrollIntoView());
  await expect(nav.getByRole('button', { name: 'What it asks permission for' })).toHaveAttribute('aria-current', 'location');
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(nav.getByRole('button', { name: 'Reporting a problem' })).toHaveAttribute('aria-current', 'location');

  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByRole('heading', { name: 'Open your scripts folder' })).toBeVisible();
});

test("For IT in the sealed app: its own copy, with no address and the sealed file's checks", async ({ page }) => {
  await page.goto(`./${SEALED_FILE}`);
  await page.getByRole('button', { name: 'Help and version' }).click();
  await page.getByRole('menuitem', { name: 'For IT' }).click();
  await expect(page.getByText(/^None\. The sealed file's policy names no address/)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'IndexedDB script-studio-models' })).toBeVisible();
  await expect(page.getByRole('heading', { name: "1. It's the file we published" })).toBeVisible();
  await expect(page.getByText(/ · sealed · this page changes with the code/)).toBeVisible();
});
