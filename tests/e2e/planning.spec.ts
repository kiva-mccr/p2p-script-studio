import { expect, test, type Page } from './base';
import { readFileSync } from 'node:fs';
import { readFile, setUp, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const PLAN = 'Episode 03/plan.md';

async function openExample(page: Page, files: Record<string, string> = {}) {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example, ...files });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

test('the Planning tab opens notes that save to plan.md, and stays open', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Open planning' }).click();
  const notes = page.getByLabel('Planning notes');
  await expect(notes).toHaveAttribute('placeholder', /Learning goals, an outline, notes/);
  await notes.fill('Learning goals');
  await notes.press('End');
  await notes.press('Enter');
  await page.getByRole('button', { name: 'Tick box (again to tick it)' }).click();
  await notes.pressSequentially('Name the three ingredients');
  await notes.press('Enter');
  await notes.pressSequentially('Say what chloroplasts do');
  await expect(page.getByText('Kept with the script, in plan.md', { exact: true })).toBeVisible({ timeout: 10000 });
  expect(await readFile(page, PLAN)).toBe('Learning goals\n- [ ] Name the three ingredients\n- [ ] Say what chloroplasts do');
  // The script itself is untouched.
  expect(await readFile(page, 'Episode 03/script.md')).toBe(example);
  // Shown as tick boxes once you click away.
  await page.getByLabel('Dialogue, row 1').click();
  await expect(page.getByLabel('Planning').getByText('☐ Name the three ingredients')).toBeVisible();

  // Open in Review too (shown there, #233), and still open after a reload.
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(page.getByRole('checkbox', { name: 'Say what chloroplasts do' })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Planning notes')).toHaveValue(/Say what chloroplasts do/);
  await page.getByRole('button', { name: 'Close planning' }).click();
  await expect(page.getByRole('button', { name: 'Open planning' })).toBeVisible();
  await expect(page.getByLabel('Planning notes')).toHaveCount(0);
});

test('someone else\'s plan shows quietly, and saves at the same time are combined', async ({ page }) => {
  await openExample(page, { [PLAN]: 'Outline\n1. Hook\n' });
  await page.getByRole('button', { name: 'Open planning' }).click();
  const notes = page.getByLabel('Planning notes');
  await expect(notes).toHaveValue('Outline\n1. Hook\n');
  await writeFile(page, PLAN, 'Outline\n1. Hook\n2. Ingredients\n');
  await expect(notes).toHaveValue('Outline\n1. Hook\n2. Ingredients\n', { timeout: 10000 });

  // You type while they save: both are kept.
  await notes.fill('Outline\n1. Hook\n2. Ingredients\nNotes: keep it short\n');
  await writeFile(page, PLAN, 'Outline\n1. Hook\n2. Ingredients\n3. Payoff\n');
  await expect(notes).toHaveValue('Outline\n1. Hook\n2. Ingredients\nNotes: keep it short\n\n3. Payoff\n', { timeout: 10000 });
  expect(await readFile(page, PLAN)).toBe('Outline\n1. Hook\n2. Ingredients\nNotes: keep it short\n\n3. Payoff\n');
});

test('not on History', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Open planning' }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByLabel('Planning notes')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open planning' })).toHaveCount(0);
});

test('in Review the plan is shown: tick boxes tick with a click and save, and Edit opens the text box (#233)', async ({ page }) => {
  await openExample(page, { [PLAN]: 'Before filming\n- [x] Check the river shot with **Ana**\n- [ ] Book the drone\n- A bullet\n' });
  await page.getByRole('button', { name: /^Review/ }).click();
  await page.getByRole('button', { name: 'Open planning' }).click();
  const panel = page.getByRole('complementary', { name: 'Planning' });
  await expect(page.getByLabel('Planning notes')).toHaveCount(0);
  await expect(panel.getByText('Before filming')).toBeVisible();
  await expect(panel.getByText('• A bullet')).toBeVisible();
  await expect(panel.locator('strong')).toHaveText('Ana');
  const river = panel.getByRole('checkbox', { name: 'Check the river shot with Ana' });
  const drone = panel.getByRole('checkbox', { name: 'Book the drone' });
  await expect(river).toBeChecked();
  await expect(drone).not.toBeChecked();

  // A click ticks it, and it saves as typing does.
  await drone.click();
  await river.click();
  await expect(drone).toBeChecked();
  await expect(river).not.toBeChecked();
  await expect.poll(() => readFile(page, PLAN), { timeout: 10000 })
    .toBe('Before filming\n- [ ] Check the river shot with **Ana**\n- [x] Book the drone\n- A bullet\n');

  // Edit opens the same text box as Write; Done shows the plan again.
  await panel.getByRole('button', { name: 'Edit' }).click();
  const notes = page.getByLabel('Planning notes');
  await expect(notes).toBeFocused();
  await notes.press('Control+End');
  await notes.pressSequentially('Notes');
  await panel.getByRole('button', { name: 'Done' }).click();
  await expect(notes).toHaveCount(0);
  await expect(panel.getByText('Notes', { exact: true })).toBeVisible();
  await expect.poll(() => readFile(page, PLAN), { timeout: 10000 }).toMatch(/- A bullet\nNotes$/);

  // Write still types straight in, with no Edit button.
  await page.getByRole('button', { name: /^Write/ }).click();
  await expect(page.getByLabel('Planning notes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
});

test('an empty plan in Review says so, and Edit lets you start one', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: /^Review/ }).click();
  await page.getByRole('button', { name: 'Open planning' }).click();
  await expect(page.getByText('No planning notes yet.')).toBeVisible();
  await page.getByRole('complementary', { name: 'Planning' }).getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByLabel('Planning notes')).toBeFocused();
});
