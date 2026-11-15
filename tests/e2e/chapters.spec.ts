import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { listFiles, setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const VERSIONS = 'Episode 03/.studio/versions';
const CHAPTERS = 'Episode 03/.studio/chapters';

// 30 versions by Ana, the newest being script.md as it is.
function history(): Record<string, string> {
  const files: Record<string, string> = { 'Episode 03/script.md': example };
  for (let i = 0; i < 30; i++) {
    const when = new Date(Date.UTC(2026, 10, 1, 9, i)).toISOString().replace(/\.\d+Z$/, 'Z');
    const id = `v${String(i).padStart(7, '0')}`;
    const text = i === 29 ? example : example.replace('running a tiny factory', `running tiny factory ${i}`);
    const entry = { v: 1, id, parents: i ? [`v${String(i - 1).padStart(7, '0')}`] : [], who: 'Ana', when, kind: 'edit', note: '', sha256: createHash('sha256').update(text).digest('hex'), text };
    files[`${VERSIONS}/${when.replace(/[-:]/g, '')}_${id}.json`] = JSON.stringify(entry);
  }
  return files;
}

test('the keeper packs History into chapters, and History still shows every version (PF-13)', async ({ page }) => {
  // Chapters of 5, single files removed as soon as packed, and a look inside the script every check.
  await page.addInitScript(() => {
    localStorage.setItem('chapter-size', '5');
    localStorage.setItem('chapter-keep', '0');
    localStorage.setItem('full-every', '2000');
  });
  await setUp(page, '#/Episode%2003', history());
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  // 30 loose: packed 5 at a time while 30 or more are loose (5 + 25 left), so one chapter, then its files go.
  await expect.poll(() => listFiles(page, CHAPTERS), { timeout: 30_000 }).toHaveLength(1);
  await expect.poll(() => listFiles(page, VERSIONS), { timeout: 30_000 }).toHaveLength(25);
  await page.getByRole('button', { name: 'History' }).click();
  const versions = page.getByRole('navigation', { name: 'Versions' }).getByRole('button');
  await expect(versions).toHaveCount(30);
  await expect(versions.last()).toContainText('Created the script');
  // A later visit, with this browser's memory of History wiped: it reads the chapter.
  await page.evaluate(() => Promise.all(['script-studio-history', 'script-studio-chapters'].map((name) => new Promise((done) => {
    const q = indexedDB.deleteDatabase(name);
    q.onsuccess = q.onerror = q.onblocked = done;
  }))));
  await page.reload();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(versions).toHaveCount(30);
  await expect(versions.last()).toContainText('Created the script');
});
