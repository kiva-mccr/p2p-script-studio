import { expect, test, type Page } from './base';
import { readFileSync } from 'node:fs';
import { readFile, readJsonFiles, setUp } from './folder';

// Flags on rows (AP-9, mock-up 22): kept with the comments in .studio/comments/, never in script.md.
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const COMMENTS = 'Episode 03/.studio/comments';
const ids = [...example.matchAll(/<!-- id: (\w+) -->/g)].map((m) => m[1]);

async function open(page: Page, files: Record<string, string> = {}) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example, ...files });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

// Oldest first, by `when` (file names keep only seconds).
const notes = async (page: Page) =>
  (await readJsonFiles(page, COMMENTS))
    .sort((a, b) => (a.when < b.when ? -1 : 1));

const flagFile = (row: string, who: string, text: string, when: string) => ({
  [`${COMMENTS}/${when.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}_${who.toLowerCase()}0flag.json`]:
    JSON.stringify({ v: 1, id: `${who.toLowerCase()}0flag`, kind: 'flag', who, when, row, text }),
});

test('flag a row, add a note, pick Needs a source, and clear it; script.md never changes', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('group', { name: 'Flags' })).toHaveCount(0);
  await page.getByLabel('Dialogue, row 1').hover();
  await page.getByRole('button', { name: 'Flag row 2' }).click();
  // The cursor goes to the new flag's note.
  const note = page.getByLabel('Flag note, row 2');
  await expect(note).toBeFocused();
  await expect(page.getByRole('button', { name: 'Clear the flag on row 2' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('group', { name: 'Flags' })).toContainText('1 of 1 flagged');
  await note.fill('Check this fact');
  await note.press('Enter');
  await expect.poll(async () => (await notes(page)).map((n) => [n.kind, n.row, n.text, n.who])).toEqual([
    ['flag', ids[1], '', 'Sam'],
    ['flag', ids[1], 'Check this fact', 'Sam'],
  ]);
  // "Needs a source" is offered while the note is empty.
  await page.getByRole('button', { name: 'Flag row 4' }).click();
  await page.getByRole('button', { name: 'Needs a source' }).click();
  await expect(page.getByLabel('Flag note, row 4')).toHaveValue('Needs a source');
  await expect(page.getByRole('button', { name: 'Needs a source' })).toHaveCount(0);
  // Clear.
  await page.locator(`[data-row="${ids[1]}"]`).getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(page.getByLabel('Flag note, row 2')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Flags' })).toContainText('1 flagged');
  expect((await notes(page)).at(-1)).toMatchObject({ kind: 'unflag', row: ids[1] });
  expect(await readFile(page, SCRIPT)).toBe(example);
});

test('step through flags in row order; Review shows them; they join the check before Approve', async ({ page }) => {
  await open(page, {
    ...flagFile(ids[3], 'Ana', 'Check the formula', '2026-11-09T10:00:00Z'),
    ...flagFile(ids[0], 'Kiva', 'Needs a source', '2026-11-09T11:00:00Z'),
  });
  const group = page.getByRole('group', { name: 'Flags' });
  await expect(group).toContainText('2 flagged');
  await group.getByRole('button', { name: 'Next flag' }).click();
  await expect(group).toContainText('1 of 2 flagged');
  await expect(page.locator(`[data-row="${ids[0]}"]`)).toHaveClass(/stepped/);
  await group.getByRole('button', { name: 'Next flag' }).click();
  await expect(group).toContainText('2 of 2 flagged');
  await expect(page.locator(`[data-row="${ids[3]}"]`)).toHaveClass(/stepped/);
  await group.getByRole('button', { name: 'Next flag' }).click();
  await expect(group).toContainText('1 of 2 flagged');
  await group.getByRole('button', { name: 'Previous flag' }).click();
  await expect(group).toContainText('2 of 2 flagged');

  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(page.getByLabel('Flag, row 1')).toContainText('Needs a source');
  await expect(page.getByLabel('Flag, row 4')).toContainText('Check the formula');
  await expect(page.getByRole('button', { name: /Flag row|Clear/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'Approve' }).click();
  const panel = page.getByRole('region', { name: 'Still open' });
  await expect(panel.getByRole('button').nth(0)).toContainText('Flag · Kiva · row 1Needs a source');
  await expect(panel.getByRole('button').nth(1)).toContainText('Flag · Ana · row 4Check the formula');
  // A flag's line goes back to Write, to that flag's note.
  await panel.getByRole('button', { name: /Flag · Ana/ }).click();
  await expect(page.getByLabel('Flag note, row 4')).toBeFocused();
});

test("a flag's own ‹ › step to the previous or next flag (#256)", async ({ page }) => {
  await open(page, flagFile(ids[3], 'Ana', 'Check the formula', '2026-11-09T10:00:00Z'));
  // One flag: nothing to step to, so no arrows on it.
  await expect(page.locator(`[data-row="${ids[3]}"] .flag-note`)).toBeVisible();
  await expect(page.getByRole('group', { name: /^Flag \d of/ })).toHaveCount(0);
  await page.getByLabel('Dialogue, row 1').hover();
  await page.getByRole('button', { name: 'Flag row 1' }).click();
  await page.getByRole('button', { name: 'Flag row 3' }).click();
  const on = (i: number) => page.locator(`[data-row="${ids[i]}"]`);
  const top = page.getByRole('group', { name: 'Flags' });
  await expect(on(2).getByRole('group', { name: 'Flag 2 of 3' })).toContainText('2 of 3');
  await on(2).getByRole('button', { name: 'Next flag' }).click();
  await expect(top).toContainText('3 of 3 flagged');
  await expect(on(3)).toHaveClass(/stepped/);
  // The same arrow on the next flag takes the focus, so Enter keeps stepping; it goes round.
  await expect(on(3).getByRole('button', { name: 'Next flag' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(top).toContainText('1 of 3 flagged');
  await expect(on(0)).toHaveClass(/stepped/);
  await on(0).getByRole('button', { name: 'Previous flag' }).click();
  await expect(top).toContainText('3 of 3 flagged');
  await expect(on(3).getByRole('button', { name: 'Previous flag' })).toBeFocused();
});

test('a flag on a deleted row is left out, and Undo brings it back', async ({ page }) => {
  await open(page, flagFile(ids[2], 'Ana', 'Too fast?', '2026-11-09T10:00:00Z'));
  await expect(page.getByRole('group', { name: 'Flags' })).toContainText('1 flagged');
  await page.getByLabel('Dialogue, row 3').hover();
  await page.getByRole('button', { name: 'Delete row 3' }).click();
  await expect(page.getByRole('group', { name: 'Flags' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Flag note, row 3')).toHaveValue('Too fast?');
});

test('the list counts flagged rows', async ({ page }) => {
  await setUp(page, '', {
    [SCRIPT]: example,
    ...flagFile(ids[0], 'Ana', '', '2026-11-09T10:00:00Z'),
    ...flagFile(ids[1], 'Ana', 'Check', '2026-11-09T10:00:01Z'),
  });
  await expect(page.getByText('2 flagged')).toBeVisible();
});
