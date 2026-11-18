import { expect, test } from './base';
import { listFiles, readFile, setUp } from './folder';

// AP-15 (board 67): templates, made from the arrow beside New script and started from in the same menu.

const lesson = [
  '---',
  'title: Lesson',
  'status: draft',
  'authors: [Ana]',
  'template: true',
  'credits: [{"id": "p1", "name": "Ana", "role": "Narrator"}]',
  '---',
  '',
  '# Hook',
  '',
  '## 1 <!-- id: aaaaa -->',
  'Dialogue:',
  'Ask a question.',
  '',
  'On screen:',
  'Title card.',
  '',
  'Files:',
  '- assets/logo.svg',
  '',
].join('\n');

test('New template makes a template that sits at the bottom of the list', async ({ page }) => {
  await setUp(page, '', { 'Ep 01/script.md': '---\ntitle: Ep 01\nstatus: draft\n---\n' });
  await page.getByRole('button', { name: 'More ways to start' }).click();
  await page.getByRole('menuitem', { name: 'New template' }).click();
  await page.getByLabel('Name of the new template').fill('Lesson');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/#\/Lesson$/);
  expect(await readFile(page, 'Lesson/script.md')).toContain('template: true');
  await page.getByRole('link', { name: 'Video Scripts' }).click();
  const rows = page.locator('a.row');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(1)).toContainText('Lesson');
  await expect(rows.nth(1)).toContainText('Template');
  await expect(rows.nth(0)).toContainText('Draft');
});

test('a new script from a template copies its rows and files, not its history, comments or credits', async ({ page }) => {
  await setUp(page, '', {
    'Lesson/script.md': lesson,
    'Lesson/assets/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'Lesson/.studio/comments/20261109T141000Z_c.json': '{}',
    'Lesson/voice/row-aaaaa.json': '{}',
  });
  await page.getByRole('button', { name: 'More ways to start' }).click();
  await page.getByRole('menuitem', { name: 'Lesson' }).click();
  await expect(page.getByText('From the Lesson template')).toBeVisible();
  await page.getByLabel('Name of the new script').fill('Ep 06');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page).toHaveURL(/#\/Ep%2006$/);
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Ask a question.');
  const text = await readFile(page, 'Ep 06/script.md');
  expect(text).toContain('title: Ep 06');
  expect(text).toContain('authors: [Sam]');
  expect(text).toContain('# Hook');
  expect(text).toContain('- assets/logo.svg');
  expect(text).not.toContain('template:');
  expect(text).not.toContain('credits:');
  expect(text).not.toContain('id: aaaaa');
  expect(await listFiles(page, 'Ep 06/assets')).toEqual(['logo.svg']);
  expect(await listFiles(page, 'Ep 06/voice')).toEqual([]);
  expect(await listFiles(page, 'Ep 06/.studio/comments')).toEqual([]);
});

test('templates never show under For me, and New script alone still starts blank', async ({ page }) => {
  await setUp(page, '', { 'Lesson/script.md': lesson });
  await page.getByRole('button', { name: 'For me' }).click();
  await expect(page.getByRole('heading', { name: 'Nothing waiting for you' })).toBeVisible();
  await page.getByRole('button', { name: 'New script', exact: true }).click();
  await expect(page.getByText('From the Lesson template')).toBeHidden();
  await page.getByLabel('Name of the new script').fill('Blank');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('');
});
