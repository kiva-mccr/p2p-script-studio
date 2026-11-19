import { expect, test } from './base';
import { fakeFolder } from './folder';

// The example to try (AP-33): a made-up script kept in the browser's private storage, never in the shared folder.

test('the example opens with its pictures, comments and History, and nothing is remembered as the folder', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await expect(page.getByText('Example script.')).toBeVisible();
  await page.getByText('How Photosynthesis Works').click();
  await expect(page.getByText('Every leaf you have ever seen is running a tiny factory.')).toBeVisible();
  await expect(page.locator('img[alt="leaf-closeup.jpg"], img[src^="blob:"]').first()).toBeVisible();
  // Matched by its start: its name can gain a count of what's new (RV-21).
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(page.getByText('Could we shoot a real leaf for this instead of stock footage?')).toBeVisible();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('Sent for review').first()).toBeVisible();

  // A reload stays in the example; leaving it goes back to the first-time screen at the list.
  await page.reload();
  await expect(page.getByText('Example script.')).toBeVisible();
  await page.getByRole('button', { name: 'Open your scripts folder' }).click();
  await expect(page.getByRole('heading', { name: 'Open your scripts folder' })).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Open your scripts folder' })).toBeVisible();
});

test('the example bar stays at the top of the window when the script scrolls, with the top bar under it (issue #203)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByText('How Photosynthesis Works').click();
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  const bar = page.locator('.example');
  const header = page.locator('header');
  await page.mouse.wheel(0, 3000);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(200);
  const b = (await bar.boundingBox())!;
  expect(b.y).toBe(0);
  // The top bar sits right under it, nothing hides behind either, and the tour can still be started.
  await expect.poll(async () => (await header.boundingBox())!.y).toBe(b.height);
  const h = (await header.boundingBox())!;
  expect(await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')))).toBe(b.height + h.height);
  await page.getByRole('button', { name: 'Take the tour' }).click();
  await expect(page.getByRole('dialog', { name: 'Tour' })).toBeVisible();
  expect((await bar.boundingBox())!.y).toBe(0);
});

test('keeps a typed name, but not Guest', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByRole('button', { name: 'Open your scripts folder' }).click();
  await expect(page.getByLabel('Your name')).toHaveValue('');
  await page.getByLabel('Your name').fill('Robin');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByRole('button', { name: 'Open your scripts folder' }).click();
  await expect(page.getByLabel('Your name')).toHaveValue('Robin');
});

test('edits are kept for the next visit, and Start over puts it back, with Undo', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByText('How Photosynthesis Works').click();
  await page.getByLabel('Dialogue, row 1').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' Kept.');
  await expect(page.getByRole('status')).toHaveText('Saved');

  await page.getByRole('button', { name: 'Open your scripts folder' }).click();
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByText('How Photosynthesis Works').click();
  const row1 = page.getByLabel('Dialogue, row 1');
  await expect(row1).toHaveValue('Every leaf you have ever seen is running a tiny factory. Kept.');

  await page.getByRole('button', { name: 'Start over' }).click();
  await expect(page.getByText('The example is back as new.')).toBeVisible();
  await expect(row1).toHaveValue('Every leaf you have ever seen is running a tiny factory.');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(row1).toHaveValue('Every leaf you have ever seen is running a tiny factory. Kept.');
});

test('the offer folds to one line, and stays folded on the next visit', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Minimize' }).click();
  await expect(page.getByRole('button', { name: 'Open the example' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open the example' })).toHaveCount(0);
  await page.getByRole('button', { name: '▸ Try it with an example' }).click();
  await expect(page.getByRole('button', { name: 'Open the example' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open the example' })).toBeVisible();
});

test('the real folder is still opened as before, and the example never shows in it', async ({ page }) => {
  await fakeFolder(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByRole('button', { name: 'Open your scripts folder' }).click();
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'Choose folder' }).click();
  await expect(page.getByText('Video Scripts')).toBeVisible();
  await expect(page.getByText('How Photosynthesis Works')).toHaveCount(0);
  await expect(page.getByText('Example script.')).toHaveCount(0);
});

test('the example shows every kind of file the app previews, and a take on every row', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByText('How Photosynthesis Works').click();
  await expect(page.getByRole('button', { name: 'Play leaf-push-in.mp4 here' })).toBeVisible(); // a still, no player yet
  await expect(page.getByRole('button', { name: 'Play music-bed.mp3' })).toBeVisible();
  await expect(page.getByText('Page 1 of 1')).toBeVisible(); // the PDF
  await expect(page.getByRole('button', { name: 'Open cell-micrograph.tif' })).toBeVisible();
  await expect(page.getByText('Glucose model: notes for the animator')).toBeVisible(); // Word
  await expect(page.getByText('Park shot list (made up)')).toBeVisible(); // text
  await expect(page.getByText('· PowerPoint')).toBeVisible(); // a kind with no preview
  // Every row has a take, read from the current words, so none is Outdated and the whole script is recorded.
  // Kiva narrates; Ana is the second voice, on row 4 (#221).
  await expect(page.getByText(/wpm · Kiva/)).toHaveCount(4);
  await expect(page.getByText(/wpm · Ana/)).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Speaker, row 4: Ana. Click to change' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Speaker, row 1: Narrator. Click to change' })).toBeVisible();
  await expect(page.getByText('Outdated')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Play the script' })).toBeVisible();
});

test('the example shows off the recent features: timeline, a send back, a held comment, sorting and who was here (AP-47)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByText('How Photosynthesis Works').click();
  // Sam's version: holds and placeholders as bars, a picture only for the timeline, and the timeline itself.
  await expect(page.getByRole('button', { name: 'Hold after row 2, 2 seconds' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Placeholder after row 4, 3 seconds' })).toBeVisible();
  await expect(page.getByText('+1 for the timeline')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Timeline' })).toHaveCount(1);
  // Ana left three hours ago.
  await expect(page.getByRole('button', { name: 'Ana · 3 h ago' })).toBeVisible();
  // Review counts the four rows Sam changed since Ana sent it back, and marks them.
  await expect(page.getByRole('button', { name: /^Review/ })).toContainText('4');
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(page.getByText('Zoom slowed down, and there\'s a timeline under the script for the filmmakers.')).toBeVisible();
  await expect(page.getByText('4 rows changed')).toBeVisible();
  // Three open comments in a different order by line, time and type; Leo's is on hold.
  const aside = page.getByRole('complementary', { name: 'Comments' });
  await expect(aside.getByRole('button', { name: 'On hold · 1' })).toBeVisible();
  const order = async () => (await aside.locator('article').allTextContents()).map((t) =>
    t.includes('real leaf') ? 'leaf' : t.includes('everyday') ? 'everyday' : t.includes('slow down') ? 'slow' : '?').join(' ');
  await expect.poll(order).toBe('leaf everyday slow');
  const sort = aside.getByRole('group', { name: 'Sort comments' });
  await sort.getByRole('button', { name: 'Time' }).click();
  await expect.poll(order).toBe('slow everyday leaf');
  await sort.getByRole('button', { name: 'Type' }).click();
  await expect.poll(order).toBe('everyday leaf slow');
});

test('the example has contacts, credits, a plan, a flag, an equation, a file on a comment, a resolved one and a template', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  // A template sits at the bottom of the list.
  await expect(page.locator('a.row').last()).toContainText('Science explainer');
  await expect(page.locator('a.row').last()).toContainText('Template');
  await page.getByText('How Photosynthesis Works').click();
  await expect(page.getByRole('group', { name: 'Flags' })).toContainText('1 flagged');
  await expect(page.locator('.katex').first()).toBeVisible();
  await page.getByRole('button', { name: 'Open planning' }).click();
  await expect(page.getByLabel('Planning notes')).toHaveValue(/Learning goals/);
  // The credits, with each person's made-up contact details.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Credits' }).click();
  const credits = page.getByRole('dialog', { name: 'Credits' });
  await expect(credits.getByLabel('What Maya did on this script')).toHaveValue('Animator');
  await expect(credits.getByText('jordan@example.org')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Review/ }).click();
  const aside = page.getByRole('complementary', { name: 'Comments' });
  await expect(aside.getByText('leaf-from-my-garden.jpg')).toBeVisible();
  await expect(aside.getByRole('button', { name: 'Resolved · 1' })).toBeVisible();
});

test('several people show wherever several can be: notes for the writer, a missing shot, who was here (#213)', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByText('How Photosynthesis Works').click();
  // Ana was here last; Leo the day before.
  await page.getByRole('button', { name: 'Ana · 3 h ago' }).click();
  await expect(page.getByRole('region', { name: 'Who has been here' }).locator('.person b')).toHaveText(['Ana', 'Leo']);
  await page.getByRole('button', { name: 'Ana · 3 h ago' }).click();
  // Sam sent it; Ana has added her note for the writer, waiting for whoever sends it back.
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(page.getByRole('note', { name: 'Note from Sam' })).toBeVisible();
  await page.getByRole('button', { name: 'Send back to writer' }).click();
  const back = page.getByRole('region', { name: 'Send back to writer' });
  await expect(back.getByRole('note', { name: "Ana's note" })).toContainText('Happy with the science.');
  await page.keyboard.press('Escape');
  // The first send back carried Ana's message and Leo's note.
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByText('Leo: My class tried it')).toBeVisible();
  // Two people on the park shot, one on the real leaf.
  await page.getByRole('button', { name: /^Assets/ }).click();
  const finds = page.getByRole('region', { name: 'Assets' }).locator('li.find');
  await expect(finds.filter({ hasText: 'Park b-roll' }).locator('.person')).toHaveText(['Jordan×', 'Leo×']);
  await expect(finds.filter({ hasText: 'A real leaf' }).locator('.person')).toHaveText(['Jordan×']);
});
