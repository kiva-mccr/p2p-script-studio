import { expect, test, type Page } from './base';
import { readFileSync } from 'node:fs';
import { changeFile, listFiles, setUp, writeFile } from './folder';

// One "what's new" folder for the drive (PF-15): every write leaves a note there, and the 5 s check and the list look
// inside a script only when it has a new note, or at the full look (2 minutes; shortened here) for outside edits.
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const NEWS = '.studio/news';

async function openExample(page: Page, files: Record<string, string> = {}) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example, ...files });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

test('a save leaves a note in the news folder naming the script', async ({ page }) => {
  await openExample(page);
  await page.getByLabel('On screen, row 1').fill('Wide shot of a forest.');
  await expect(page.getByRole('status')).toHaveText('Saved');
  const notes = await listFiles(page, NEWS);
  expect(notes.length).toBeGreaterThan(0);
  for (const note of notes) expect(note).toMatch(/^\d{8}T\d{9}Z_[a-z0-9]{6}_Episode 03\.json$/);
});

test('a change with no note waits for the full look; one with a note shows at the next check', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('full-every', '20000'));
  await openExample(page);
  await page.waitForTimeout(2000); // opening is done (it reads every change file)
  // Ana's save, but no note: as if written outside the app.
  const [path, text] = changeFile('Episode 03', 'Ana', example, example.replace('Slow push-in on a sunlit leaf.', 'No note.'));
  await writeFile(page, path, text, { outside: true });
  await page.waitForTimeout(8000); // a check or two
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Slow push-in on a sunlit leaf.');
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('No note.', { timeout: 20000 });

  // With a note, the next 5 s check takes it.
  const [path2, text2] = changeFile('Episode 03', 'Ana', example.replace('Slow push-in on a sunlit leaf.', 'No note.'), example.replace('Slow push-in on a sunlit leaf.', 'With a note.'));
  await writeFile(page, path2, text2);
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('With a note.', { timeout: 8000 });
});

test('notes over an hour old are removed at the full look', async ({ page }) => {
  const old = `${NEWS}/20200101T000000000Z_abc123_Episode 03.json`;
  await openExample(page, { [old]: '{"v":1}\n' });
  await expect.poll(() => listFiles(page, NEWS)).not.toContain(old.split('/').pop());
});

test('coming back to the list reads only scripts with a new note', async ({ page }) => {
  await setUp(page, '', { 'Trailer/script.md': '---\ntitle: Trailer\n---\n', 'Teaser/script.md': '---\ntitle: Teaser\n---\n' });
  await expect(page.locator('.table[aria-busy="false"]')).toBeVisible();
  // Changed in Notepad (no note): not looked at until the full look, 2 minutes after the last.
  await writeFile(page, 'Trailer/script.md', '---\ntitle: Trailer from Notepad\n---\n', { outside: true });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.table[aria-busy="false"]')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByRole('link', { name: /Trailer from Notepad/ })).toHaveCount(0);
  // Changed in the app (a note): read on coming back.
  await writeFile(page, 'Teaser/script.md', '---\ntitle: Teaser two\n---\n');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('link', { name: /Teaser two/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Trailer from Notepad/ })).toHaveCount(0);
});
