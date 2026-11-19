import { expect, test, type Page } from './base';
import { readFileSync } from 'node:fs';
import { readFile, readJsonFiles, setUp, writeFile } from './folder';

// Notes for the writer from several reviewers (#248, board 84): each adds one in Send back without sending; the send
// back takes them all; in Write they keep their writers' names and formatting, and the writer ticks their tick boxes.
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8'); // in review
const SCRIPT = 'Episode 03/script.md';
const NOTES = 'Episode 03/.studio/notes';
const VERSIONS = 'Episode 03/.studio/versions';
const ana = { v: 1, id: 'ananote1', by: 'Ana', who: 'Ana', made: '2026-11-19T09:00:00.000Z', when: '2026-11-19T09:00:00.000Z', text: 'Lovely pace. **Row 4** needs a source.' };

async function openReview(page: Page, files: Record<string, string> = {}) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example, ...files });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.getByRole('button', { name: /^Review/ }).click();
  await page.getByRole('button', { name: 'Send back to writer' }).click();
  return page.getByRole('region', { name: 'Send back to writer' });
}

test("another reviewer's note shows in Send back and goes with it; in Write the writer ticks the boxes", async ({ page }) => {
  const region = await openReview(page, { [`${NOTES}/20261119T090000000Z_ananote1_aaaaaaaa.json`]: JSON.stringify(ana) });
  const theirs = region.getByRole('note', { name: "Ana's note" });
  await expect(theirs).toContainText('Lovely pace. Row 4 needs a source.');
  await expect(theirs.locator('strong', { hasText: 'Row 4' })).toBeVisible();
  await region.getByLabel('Your note for the writer').fill('Agree with Ana. Also:\n- [ ] swap the *drone* shot\n- [ ] check row 7');
  await region.getByRole('button', { name: 'Send back to writer' }).click();
  await expect.poll(() => readFile(page, SCRIPT)).toContain('status: draft\n');
  // The History entry comes after script.md: wait for it.
  const sentBack = async () => (await readJsonFiles(page, VERSIONS)).find((v) => v.note === 'Sent back to writer');
  await expect.poll(sentBack).toBeTruthy();
  const back = (await sentBack())!;
  expect(back.message).toContain('- [ ] swap the *drone* shot');
  expect(back.notes).toEqual([{ id: 'ananote1', by: 'Ana', made: ana.made, text: ana.text }]);

  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: /^Open comments/ }).click();
  const sam = page.getByRole('note', { name: 'Note from Sam' });
  await expect(sam).toContainText('sent it back');
  await expect(sam.locator('em', { hasText: 'drone' })).toBeVisible();
  await expect(page.getByRole('note', { name: 'Note from Ana' })).toContainText("Ana's note");
  await expect(page.getByRole('note', { name: 'Note from Ana' }).locator('strong', { hasText: 'Row 4' })).toBeVisible();
  const box = sam.getByRole('checkbox', { name: 'swap the drone shot' });
  await box.check();
  await expect.poll(async () => (await readJsonFiles(page, NOTES)).find((n) => n.id === back.id)?.text).toContain('- [x] swap the *drone* shot');
  // Seen again on the next visit (the panel stays open on Comments).
  await page.reload();
  await expect(page.getByRole('note', { name: 'Note from Sam' }).getByRole('checkbox', { name: 'swap the drone shot' })).toBeChecked();
});

test('Add my note leaves it for the others without sending; it can be changed, then deleted', async ({ page }) => {
  const region = await openReview(page);
  const box = region.getByLabel('Your note for the writer');
  await expect(box).toBeFocused();
  await box.fill('Row 2 is long.');
  await region.getByRole('button', { name: 'Add my note' }).click();
  await expect(region.getByRole('button', { name: 'Note added ✓' })).toBeDisabled();
  await expect.poll(async () => (await readJsonFiles(page, NOTES)).map((n) => [n.by, n.text])).toEqual([['Sam', 'Row 2 is long.']]);
  expect(await readFile(page, SCRIPT)).toContain('status: in review');

  // A new visit finds it in the box.
  await page.reload();
  await page.getByRole('button', { name: /^Review/ }).click();
  await page.getByRole('button', { name: 'Send back to writer' }).click();
  await expect(region.getByLabel('Your note for the writer')).toHaveValue('Row 2 is long.');
  await region.getByLabel('Your note for the writer').fill('Row 2 is too long.');
  await region.getByRole('button', { name: 'Save my note' }).click();
  await expect(region.getByRole('button', { name: 'Note added ✓' })).toBeVisible();
  await region.getByRole('button', { name: 'Delete my note' }).click();
  await expect(region.getByLabel('Your note for the writer')).toHaveValue('');
  await expect.poll(async () => (await readJsonFiles(page, NOTES)).length).toBe(3);
  const files = await readJsonFiles(page, NOTES);
  expect(new Set(files.map((n) => n.id)).size).toBe(1);
  expect(files.some((n) => n.removed)).toBe(true);
});

test("another reviewer's note added while the menu is open still goes with the send back", async ({ page }) => {
  const region = await openReview(page);
  await writeFile(page, `${NOTES}/20261119T090000000Z_ananote1_aaaaaaaa.json`, JSON.stringify(ana));
  await region.getByRole('button', { name: 'Send back to writer' }).click();
  await expect.poll(async () => (await readJsonFiles(page, VERSIONS)).find((v) => v.note === 'Sent back to writer')?.notes?.length).toBe(1);
});
