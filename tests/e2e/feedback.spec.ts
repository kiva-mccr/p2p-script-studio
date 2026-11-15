import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp } from './folder';

// Feedback mode (AP-48, board 71): click a part, write a note, and GitHub's new issue page opens filled in.

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const firstLine = 'Every leaf you have ever seen is running a tiny factory.';

async function openScript(page: Page) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.context().route('https://github.com/**', (r) => r.fulfill({ body: 'GitHub' }));
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example });
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue(firstLine);
}

async function issueFrom(page: Page, click: () => Promise<void>) {
  const popup = page.waitForEvent('popup');
  await click();
  const url = new URL((await popup).url());
  return { url, title: url.searchParams.get('title')!, body: url.searchParams.get('body')! };
}

test('clicking a part opens a GitHub issue that says what and where, with the picture copied', async ({ page }) => {
  await openScript(page);
  await page.getByRole('button', { name: 'Feedback' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'click the part' })).toBeVisible();

  // The click picks the part; the page's own click is held back (no recording starts).
  await page.getByRole('button', { name: 'Record row 1' }).click();
  const panel = page.getByRole('region', { name: 'Feedback' });
  await expect(panel.getByRole('heading')).toHaveText('Feedback on: button "Record row 1", row 1');
  await expect(page.getByRole('button', { name: 'Stop recording row 1' })).toHaveCount(0);
  await expect(panel.getByRole('textbox')).toBeFocused();
  await panel.getByRole('textbox').fill('Hard to tell when it is recording.');
  const picture = panel.getByRole('img', { name: 'The part, outlined' });
  await expect(picture).toBeVisible();
  // Unblurred, the picture is made again.
  const blurred = await picture.getAttribute('src');
  await panel.getByLabel("Blur the script's words in it").uncheck();
  await expect(picture).not.toHaveAttribute('src', blurred!);
  await panel.getByLabel("Blur the script's words in it").check();
  await expect(picture).toBeVisible();

  const { url, title, body } = await issueFrom(page, () => panel.getByRole('button', { name: 'Open on GitHub' }).click());
  expect(url.origin + url.pathname).toBe('https://github.com/kiva-mccr/p2p-script-studio/issues/new');
  expect(url.searchParams.get('labels')).toBe('feedback');
  expect(title).toBe('Feedback: button "Record row 1" (Write)');
  expect(body).toContain('Hard to tell when it is recording.');
  expect(body).toContain('| Screen | Write |');
  expect(body).toContain('| Code | WriteRow.svelte, data-tour="take" |');
  expect(body).toContain('| Row, column | row 1, the mic |');
  expect(body).toMatch(/\| Selector \| `\[data-row="[^"]+"\] > .*button\.mic/);
  expect(body).toContain('| Version | dev build |');
  expect(body).toMatch(/\| Browser \| Chrome \d+ on \w+, window 1280 × 720 \|/);
  expect(body).toContain('Paste the picture here');
  // Nothing from the script unless allowed: no name, no address, no words.
  expect(body).not.toContain('Episode');
  expect(body).not.toContain('tiny factory');
  await expect(panel.getByRole('status')).toContainText('The picture is copied');
  const types = await page.evaluate(async () => (await navigator.clipboard.read()).flatMap((i) => i.types));
  expect(types).toContain('image/png');

  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel).toHaveCount(0);
  // Back to normal: the mic records again.
  await expect(page.locator('html')).not.toHaveClass(/feedback-picking/);
});

test('a text box says its column; the script can be named; Copy instead copies the same text', async ({ page }) => {
  await openScript(page);
  await page.getByRole('button', { name: 'Feedback' }).click();
  await page.getByLabel('On screen, row 2').click();
  const panel = page.getByRole('region', { name: 'Feedback' });
  await expect(panel.getByRole('heading')).toHaveText('Feedback on: text box "On screen, row 2", row 2');
  await panel.getByLabel('Say which script').check();
  await panel.getByLabel('Add a picture of this part').uncheck();
  await expect(panel.getByRole('img')).toHaveCount(0);

  await panel.getByRole('button', { name: 'Copy instead' }).click();
  await expect(panel.getByRole('status')).toHaveText(/^Copied\./);
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/^Feedback: text box "On screen, row 2" \(Write\)\n\n\*\*Note\*\*/);
  expect(text).toContain('| Row, column | row 2, On screen |');
  expect(text).toContain('| Script | Episode 03 |');
  expect(text).toContain('| Screen | Write (#/Episode%2003) |');
  expect(text).not.toContain('Paste the picture');

  const { body } = await issueFrom(page, () => panel.getByRole('button', { name: 'Open on GitHub' }).click());
  expect(body).not.toContain('**Picture**');
  await expect(panel.getByRole('status')).toHaveText(/Press Submit new issue there\.$/);
});

test("a file's name is the script's, so it's left out of the part's name", async ({ page }) => {
  await openScript(page);
  await page.getByRole('button', { name: 'Feedback' }).click();
  await page.getByRole('button', { name: 'leaf-closeup.jpg', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Feedback' });
  await expect(panel.getByRole('heading')).toHaveText('Feedback on: button (a file), row 1');
  await panel.getByRole('button', { name: 'Cancel' }).click();
  await expect(panel).toHaveCount(0);
});

test('Esc stops picking, and the page works as before', async ({ page }) => {
  await openScript(page);
  await page.getByRole('button', { name: 'Feedback' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('status').filter({ hasText: 'click the part' })).toHaveCount(0);
  await page.getByLabel('Dialogue, row 1').click();
  await expect(page.getByLabel('Dialogue, row 1')).toBeFocused();
  await expect(page.getByRole('region', { name: 'Feedback' })).toHaveCount(0);
});
