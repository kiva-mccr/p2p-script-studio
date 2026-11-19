import { expect, test } from './base';
import { readFile, setUp } from './folder';

// A speaker per row (#221, board 88): a short name in Credits makes someone a speaker; Write then shows a Speaker
// column whose button goes round them; the row's Speaker: line is saved, and the exports put rows under their speaker.
const rows = '## 1 <!-- id: aaaaa -->\nDialogue:\nWhere does rain come from?\n\nOn screen:\n\nFiles:\n\n'
  + '## 2 <!-- id: bbbbb -->\nDialogue:\nFrom the sea, mostly.\n\nOn screen:\n\nFiles:\n';
const FILES = {
  'Rain/script.md': `---\ntitle: Rain\ncredits: [{"id":"jo000001","name":"Jo Park","role":"Host"}]\n---\n\n${rows}`,
};

test('a short name in Credits adds a Speaker column; a row is said by them, saved, renamed with them, and exported under them', async ({ page }) => {
  await setUp(page, '#/Rain', FILES);
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  // An older script with no speakers: no column, every row the narrator's.
  await expect(page.getByRole('button', { name: /^Speaker, row/ })).toHaveCount(0);

  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Credits' }).click();
  const box = page.getByRole('dialog', { name: 'Credits' });
  const short = box.getByLabel('Short name Jo Park speaks rows under');
  await short.fill('Narrator');
  await short.press('Enter');
  await expect(box.getByRole('alert')).toContainText('"Narrator" is taken by the narrator');
  await expect(short).toHaveValue('');
  await short.fill('Jo');
  await short.press('Enter');
  await box.locator('.foot').getByRole('button', { name: 'Done' }).click();

  const first = page.getByRole('button', { name: /^Speaker, row 1:/ });
  await expect(first).toHaveAccessibleName('Speaker, row 1: Narrator. Click to change');
  await first.click();
  await expect(first).toHaveAccessibleName('Speaker, row 1: Jo. Click to change');
  await expect(page.getByRole('button', { name: 'Record row 1' })).toHaveAttribute('title', 'Jo reads this row');
  await expect.poll(() => readFile(page, 'Rain/script.md')).toContain('## 1 <!-- id: aaaaa -->\nSpeaker: Jo\n\nDialogue:\nWhere does rain');
  // Ctrl+Z puts the narrator back, Ctrl+Y Jo again.
  await page.keyboard.press('Control+z');
  await expect(first).toHaveAccessibleName('Speaker, row 1: Narrator. Click to change');
  await page.keyboard.press('Control+y');
  await expect(first).toHaveAccessibleName('Speaker, row 1: Jo. Click to change');

  // A new short name follows onto the rows.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Credits' }).click();
  await short.fill('Jojo');
  await short.press('Enter');
  await box.locator('.foot').getByRole('button', { name: 'Done' }).click();
  await expect(first).toHaveAccessibleName('Speaker, row 1: Jojo. Click to change');
  await expect.poll(() => readFile(page, 'Rain/script.md')).toContain('Speaker: Jojo\n');

  // The column folds away like the others; a dot says the row has a speaker.
  await page.getByRole('button', { name: 'Fold Speaker away' }).click();
  await expect(first).toHaveCount(0);
  await expect(page.locator('[data-row="aaaaa"] [title="Speaker has something here"]')).toBeVisible();
  await page.getByRole('button', { name: 'Show Speaker' }).click();

  // Fountain: each row under its speaker, the rest under the narrator; the card counts each one's rows and time.
  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: 'Fountain (.fountain)' }).click();
  const preview = page.getByRole('region', { name: 'Preview' });
  await expect(preview.locator('pre')).toContainText('JOJO\nWhere does rain come from?');
  await expect(preview.locator('pre')).toContainText('NARRATOR\nFrom the sea, mostly.');
  await expect(page.getByLabel("Narrator's name")).toHaveValue('NARRATOR');
  await expect(page.getByRole('list', { name: 'Speakers' }).getByRole('listitem')).toHaveText(['Narrator (NARRATOR) 1 row, 0:02', 'Jojo 1 row, 0:02']);
});
