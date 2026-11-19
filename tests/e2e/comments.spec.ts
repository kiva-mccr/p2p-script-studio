import { expect, test, type Locator, type Page } from './base';
import { readFileSync } from 'node:fs';
import { listFiles, readFile, readJsonFiles, setUp, writeFile } from './folder';

// Review comments in Write (RV-13, board 37 idea A): a Comments tab beside Planning, bubbles on rows, quotes marked.
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const COMMENTS = 'Episode 03/.studio/comments';
const VERSIONS = 'Episode 03/.studio/versions';
const id = (n: number) => example.match(new RegExp(`## ${n} <!-- id: (\\w+) -->`))![1];

const note = (o: Record<string, string>): [string, string] => [`${COMMENTS}/${o.when.replace(/[-:]/g, '')}_${o.id}.json`, JSON.stringify({ v: 1, ...o })];
// Ana's comment on row 1's On screen, Ana's suggestion on row 3, Ben's comment on the whole of row 4.
const ANA = note({ id: 'ana00001', kind: 'comment', who: 'Ana', when: '2026-11-10T09:00:00Z', row: id(1), field: 'on_screen', quote: 'sunlit leaf', text: 'Could we shoot a real leaf?' });
const SUGGEST = note({ id: 'ana00002', kind: 'suggestion', who: 'Ana', when: '2026-11-10T09:01:00Z', row: id(3), field: 'dialogue', quote: 'catch', replace: 'absorb' });
const BEN = note({ id: 'ben00001', kind: 'comment', who: 'Ben', when: '2026-11-10T09:02:00Z', row: id(4), field: 'dialogue', quote: '', text: 'Say where the oxygen goes too.' });
const draft = example.replace('status: in review', 'status: draft');
const sentBack = (who: string): [string, string] => [`${VERSIONS}/20261110T091200Z_back0000.json`,
  JSON.stringify({ v: 1, id: 'back0000', parents: [], who, when: '2026-11-10T09:12:00Z', kind: 'review', note: 'Sent back to writer', message: 'A few wording fixes, mostly in Inside the leaf.', sha256: '', text: draft })];

async function open(page: Page, files: [string, string][], script = draft) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: script, ...Object.fromEntries(files) });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

// A mark's words: Write's marks are StaticRanges (PF-5), which have no toString, so each is read through a Range.
const marked = (page: Page, name = 'comment') => page.evaluate((name) => [...(CSS.highlights.get(name) ?? [])].map((r) => {
  const range = document.createRange();
  range.setStart(r.startContainer, r.startOffset);
  range.setEnd(r.endContainer, r.endOffset);
  return r.startContainer.isConnected ? range.toString() : '';
}), name);

test('rows with open comments get a bubble; it opens the Comments tab at that card, and quotes are marked', async ({ page }) => {
  await open(page, [ANA, SUGGEST, BEN]);
  // Closed, the edge shows both tabs.
  await expect(page.getByRole('button', { name: 'Open planning' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open comments, 3 open' })).toContainText('Comments · 3');
  await expect(page.getByRole('button', { name: '1 open comment on row 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: '1 open suggestion on row 3' })).toBeVisible();
  await expect(page.getByRole('button', { name: /open .* on row 2/ })).toHaveCount(0);
  await expect.poll(() => marked(page).then((m) => m.sort())).toEqual(['catch', 'sunlit leaf']);

  await page.getByRole('button', { name: '1 open suggestion on row 3' }).click();
  const panel = page.getByRole('complementary', { name: 'Comments' });
  await expect(panel.getByRole('button', { name: 'Comments · 3' })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByRole('article', { name: 'Suggestion by Ana' })).toContainText('Ana suggested · row 3, Dialogue');
  await expect.poll(() => marked(page, 'comment-on')).toEqual(['catch']);
  await expect(panel.getByRole('article', { name: 'Comment by Ben' })).toContainText('Ben commented · row 4');
  await expect(panel).toContainText('New comments are started in Review.');

  // Clicking a quote's words in a field opens its card.
  await page.getByLabel('On screen, row 1').click();
  await page.getByLabel('On screen, row 1').evaluate((box: HTMLTextAreaElement) => {
    const at = box.value.indexOf('sunlit') + 2;
    box.setSelectionRange(at, at);
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect.poll(() => marked(page, 'comment-on')).toEqual(['sunlit leaf']);

  // Planning is the other tab of the same panel; closing keeps the choice after a reload.
  await panel.getByRole('button', { name: 'Planning' }).click();
  await expect(page.getByLabel('Planning notes')).toBeVisible();
  await page.getByRole('complementary', { name: 'Planning' }).getByRole('button', { name: /^Comments/ }).click();
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Comments' })).toBeVisible();
  await page.getByRole('button', { name: 'Close comments' }).click();
  await expect(page.getByRole('button', { name: 'Open comments, 3 open' })).toBeVisible();

  // Review has only Planning in the panel: its comments are beside the script already.
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(page.getByRole('button', { name: /^Review/ })).toHaveText('Review'); // no open count there since RV-21
  await expect(page.getByRole('button', { name: 'Open planning' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open comments/ })).toHaveCount(0);
});

test('comments are kept in this browser, so a later visit opens only new comment files (PF-9)', async ({ page }) => {
  await open(page, [ANA, SUGGEST]);
  await expect(page.getByRole('button', { name: 'Open comments, 2 open' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => new Promise<number>((resolve) => {
    const open = indexedDB.open('script-studio-comments');
    open.onsuccess = () => {
      const count = open.result.transaction('versions').objectStore('versions').count();
      count.onsuccess = () => resolve(count.result);
    };
  }))).toBe(2);
  // Ben comments while Sam is away; the next visit opens his file and no other.
  await writeFile(page, BEN[0], BEN[1]);
  await page.addInitScript(() => {
    const getFile = FileSystemFileHandle.prototype.getFile;
    (window as unknown as { opened: string[] }).opened = [];
    FileSystemFileHandle.prototype.getFile = function () {
      if (/_(ana|ben)\d{5}\.json$/.test(this.name)) (window as unknown as { opened: string[] }).opened.push(this.name);
      return getFile.call(this);
    };
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open comments, 3 open' })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { opened: string[] }).opened)).toEqual([BEN[0].split('/').at(-1)]);
});

test('in Write the writer accepts a suggestion, resolves with Undo and replies while editing', async ({ page }) => {
  await open(page, [ANA, SUGGEST, BEN]);
  await page.getByRole('button', { name: 'Open comments, 3 open' }).click();
  const panel = page.getByRole('complementary', { name: 'Comments' });
  const suggestion = panel.getByRole('article', { name: 'Suggestion by Ana' });
  await suggestion.getByRole('button', { name: 'Accept' }).click();
  await expect(suggestion).toContainText('Accepted. The script is updated.');
  await expect(page.getByLabel('Dialogue, row 3')).toHaveValue(/chloroplasts absorb the light/);
  await expect.poll(() => readFile(page, SCRIPT)).toContain('chloroplasts absorb the light');
  await expect(page.getByRole('button', { name: /on row 3/ })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Comments · 2' })).toBeVisible();

  // Resolve asks nothing; Undo is there for a few seconds (RV-18).
  const ben = panel.getByRole('article', { name: 'Comment by Ben' });
  await ben.getByRole('button', { name: 'Resolve' }).click();
  await expect(ben).toContainText('Resolved.');
  await expect(page.getByRole('button', { name: /on row 4/ })).toHaveCount(0);
  await ben.getByRole('button', { name: 'Undo' }).click();
  await expect(ben.getByRole('button', { name: 'Resolve' })).toBeVisible();
  await expect(page.getByRole('button', { name: '1 open comment on row 4' })).toBeVisible();

  // Reply, then fix the row in Write without leaving the tab.
  const ana = panel.getByRole('article', { name: 'Comment by Ana' });
  await ana.getByRole('button', { name: 'Reply' }).click();
  await ana.getByLabel('Reply').fill('We can, next week.');
  await ana.getByRole('button', { name: 'Reply' }).click();
  await expect(ana).toContainText('We can, next week.');
  // Replacing the words it is on resolves it once saved, keeping the old and new words (RV-24).
  await page.getByLabel('On screen, row 1').fill('Slow push-in on a real leaf.');
  await expect(ana).toHaveCount(0);
  await panel.getByRole('button', { name: /Resolved · / }).click();
  await expect(ana).toContainText('The words it was on were changed: sunlit leaf → real leaf');
  await expect(ana).toContainText('Resolved when the words were replaced');
  await expect(ana).toContainText('We can, next week.');

  const files = await readJsonFiles(page, COMMENTS);
  expect(files.map((f) => f.kind).sort()).toEqual(['accept', 'comment', 'comment', 'reopen', 'reply', 'resolve', 'resolve', 'suggestion']);
  expect(files.find((f) => f.kind === 'reply')).toMatchObject({ who: 'Sam', about: 'ana00001' });
  expect(files.find((f) => f.about === 'ana00001' && f.kind === 'resolve')).toMatchObject({ who: 'Sam', why: 'replaced', was: 'sunlit leaf', now: 'real leaf' });
});

test('deleting a row resolves its comments, keeping its words and its place; Undo reopens them (RV-24, RV-25)', async ({ page }) => {
  // Ana's suggestion on row 3 and Lee's comment on row 5 were resolved before.
  const LEE = note({ id: 'lee00001', kind: 'comment', who: 'Lee', when: '2026-11-10T09:03:00Z', row: id(5), field: 'dialogue', quote: '', text: 'Nice ending.' });
  const done = (about: string, n: number) => note({ id: `done000${n}`, kind: 'resolve', who: 'Ana', when: `2026-11-10T09:0${n}:00.000Z`, about });
  await open(page, [SUGGEST, BEN, LEE, done('ana00002', 4), done('lee00001', 5)]);
  await page.getByRole('button', { name: 'Open comments, 1 open' }).click();
  const panel = page.getByRole('complementary', { name: 'Comments' });
  const ben = panel.getByRole('article', { name: 'Comment by Ben' });
  const benNotes = async () => (await readJsonFiles(page, COMMENTS)).filter((f) => f.about === 'ben00001');
  const del = async () => {
    await page.getByLabel('Dialogue, row 4').hover();
    await page.getByRole('button', { name: 'Delete row 4' }).click();
  };
  // Saved at once: the resolve is written while Undo is still offered (any click elsewhere closes it).
  await del();
  await expect(panel.getByRole('button', { name: 'Comments · 0' })).toBeVisible();
  await expect.poll(async () => (await benNotes()).map((f) => f.kind)).toEqual(['resolve']);
  expect((await benNotes())[0]).toMatchObject({ who: 'Sam', why: 'deleted', n: 4, after: id(3) });
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: '1 open comment on row 4' })).toBeVisible();
  await expect(ben.getByRole('button', { name: 'Resolve' })).toBeVisible();
  await expect.poll(async () => (await benNotes()).map((f) => f.kind).sort()).toEqual(['reopen', 'resolve']);

  await del();
  await expect(panel.getByRole('button', { name: 'Comments · 0' })).toBeVisible();
  await panel.getByRole('button', { name: 'Resolved · 3' }).click();
  await expect(ben).toHaveCount(1); // once the open card has gone
  await expect(ben).toContainText('Ben commented · a deleted row');
  await expect(ben).toContainText('Row 4, as it was when deleted: They turn it into sugar the plant uses to grow.');
  await expect(ben).toContainText('Resolved when Sam deleted the row');
  // Resolved is newest resolved first (RV-25): Ben's, resolved just now, is on top, then Lee's (9:05), then Ana's (9:04).
  await expect(panel.getByText('Newest resolved first.')).toBeVisible();
  await expect.poll(() => names(panel.getByRole('article'))).toEqual(['Comment by Ben', 'Comment by Lee', 'Suggestion by Ana']);
  // Reopened, it is back where the row was in line order, not at the end (RV-24).
  await ben.getByRole('button', { name: 'Reopen' }).click();
  await expect(panel.getByRole('button', { name: 'Comments · 1' })).toBeVisible();
  await expect(ben.getByRole('button', { name: 'Resolve' })).toBeVisible();
});

test('a resolved or decided card waits 5 seconds with Undo, then moves into Resolved by itself (RV-18)', async ({ page }) => {
  await page.clock.install();
  await open(page, [SUGGEST, BEN]);
  await page.clock.pauseAt(Date.now() + 60_000); // time moves only when the test says, so the waits can't overlap
  await page.getByRole('button', { name: 'Open comments, 2 open' }).click();
  const panel = page.getByRole('complementary', { name: 'Comments' });
  const ben = panel.getByRole('article', { name: 'Comment by Ben' });
  await ben.getByRole('button', { name: 'Resolve' }).click();
  await expect(ben).toContainText('Resolved.');
  await page.clock.runFor(3000);
  await expect(ben.getByRole('button', { name: 'Undo' })).toBeVisible();
  await expect(panel.getByRole('button', { name: /Resolved ·/ })).toHaveCount(0);
  const ana = panel.getByRole('article', { name: 'Suggestion by Ana' });
  await ana.getByRole('button', { name: 'Reject' }).click();
  await expect(ana).toContainText('Rejected.');
  // Five seconds after Resolve it moves on; the rejected one follows on its own five seconds.
  await page.clock.runFor(2500);
  await expect(ben).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Resolved · 1' })).toBeVisible();
  await expect(ana).toContainText('Rejected.');
  await page.clock.runFor(3000);
  await expect(panel.getByRole('button', { name: 'Resolved · 2' })).toBeVisible();
  await expect(panel).toContainText('No open comments.');

  // Undo within the wait keeps it open, and a later wait does not take it away.
  await panel.getByRole('button', { name: 'Resolved · 2' }).click();
  // (Each step a second apart: notes are put in order by their time, and the clock is stopped.)
  await panel.getByRole('article', { name: 'Comment by Ben' }).getByRole('button', { name: 'Reopen' }).click();
  const again = panel.getByRole('article', { name: 'Comment by Ben' });
  await page.clock.runFor(1000);
  await again.getByRole('button', { name: 'Resolve' }).click();
  await page.clock.runFor(1000);
  await again.getByRole('button', { name: 'Undo' }).click();
  await expect(again.getByRole('button', { name: 'Resolve' })).toBeVisible();
  await page.clock.runFor(6000);
  await expect(again.getByRole('button', { name: 'Resolve' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Resolved · 1' })).toBeVisible();
});

test('the card stands out; clicking the bubble again unselects it, and once more scrolls back to it (RV-17, RV-20, issue #235)', async ({ page }) => {
  await open(page, [ANA, SUGGEST, BEN]);
  await page.setViewportSize({ width: 1280, height: 420 });
  const bubble = page.getByRole('button', { name: '1 open comment on row 4' });
  await bubble.click();
  const ben = page.getByRole('complementary', { name: 'Comments' }).getByRole('article', { name: 'Comment by Ben' });
  await expect(ben).toBeInViewport({ ratio: 0.9 });
  expect(await ben.evaluate((el) => getComputedStyle(el).borderColor)).toBe('rgb(42, 91, 215)');
  await expect(page.locator('.row.talking')).toHaveCSS('background-color', 'rgb(238, 243, 253)');
  await expect(bubble).toHaveAttribute('aria-pressed', 'true');
  // A second click on the same bubble lets go of the comment: the row and the card lose their blue.
  await bubble.click();
  await expect(page.locator('.row.talking')).toHaveCount(0);
  await expect(bubble).toHaveAttribute('aria-pressed', 'false');
  expect(await ben.evaluate((el) => getComputedStyle(el).borderColor)).not.toBe('rgb(42, 91, 215)');
  // Scroll the panel away; a third click chooses it again and brings it back into view.
  await ben.evaluate((el) => {
    let box = el.parentElement;
    while (box && box.scrollHeight <= box.clientHeight) box = box.parentElement;
    box!.scrollTop = 0; // Ben's is last in line order (RV-16)
  });
  await expect(ben).not.toBeInViewport({ ratio: 0.5 });
  await bubble.click();
  await expect(ben).toBeInViewport({ ratio: 0.9 });
  await expect(page.locator('.row.talking')).toHaveCount(1);
});

test('a card takes Write to its row', async ({ page }) => {
  await open(page, [BEN]);
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.getByRole('button', { name: 'Open comments, 1 open' }).click();
  await page.getByRole('article', { name: 'Comment by Ben' }).click();
  await expect(page.getByLabel('Dialogue, row 4')).toBeInViewport();
});

test('a card for a row already on screen leaves the page where it is (UX-6)', async ({ page }) => {
  await open(page, [BEN]);
  await page.getByLabel('Dialogue, row 4').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const y = await page.evaluate(() => scrollY);
  await page.getByRole('button', { name: 'Open comments, 1 open' }).click();
  await page.getByRole('article', { name: 'Comment by Ben' }).click();
  await page.waitForTimeout(600); // a smooth scroll would have started by now
  expect(await page.evaluate(() => scrollY)).toBe(y);
  await expect(page.getByLabel('Dialogue, row 4')).toBeInViewport();
});

test('after a send back by someone else, Write opens on Comments with their note, once (RV-13)', async ({ page }) => {
  await open(page, [SUGGEST, sentBack('Ana')]);
  const panel = page.getByRole('complementary', { name: 'Comments' });
  await expect(panel).toBeVisible();
  const back = panel.getByRole('note', { name: 'Note from Ana' });
  await expect(back).toContainText('Ana sent it back');
  await expect(back).toContainText('A few wording fixes, mostly in Inside the leaf.');
  // Closed, it stays closed next time: it opens by itself only once for each send back.
  await page.getByRole('button', { name: 'Close comments' }).click();
  await page.reload();
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(panel).toHaveCount(0);
  // The note is still at the top while it is a draft.
  await page.getByRole('button', { name: 'Open comments, 1 open' }).click();
  await expect(back).toBeVisible();
});

test('your own send back does not open the panel; once sent for review again the note goes', async ({ page }) => {
  await open(page, [sentBack('Sam')]);
  await page.waitForTimeout(500);
  await expect(page.getByRole('complementary', { name: 'Comments' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open comments, 0 open' }).click();
  await expect(page.getByRole('note', { name: 'Note from Sam' })).toBeVisible();
  await expect(page.getByText('No open comments.')).toBeVisible();
  await page.getByRole('button', { name: 'Send for review' }).click();
  await page.getByRole('region', { name: 'Send for review' }).getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('In review', { exact: true })).toBeVisible();
  await expect(page.getByRole('note', { name: 'Note from Sam' })).toHaveCount(0);
});

test('Send back to writer takes a note, kept in History and shown at the top of Comments', async ({ page }) => {
  await open(page, [], example); // in review
  await page.getByRole('button', { name: /^Review/ }).click();
  await page.getByRole('button', { name: 'Send back to writer' }).click();
  const region = page.getByRole('region', { name: 'Send back to writer' });
  await expect(region.getByLabel('Your note for the writer')).toBeFocused();
  await region.getByLabel('Your note for the writer').fill('Tighten row 3.');
  await page.keyboard.press('Escape');
  await expect(region).toHaveCount(0);
  await page.getByRole('button', { name: 'Send back to writer' }).click();
  await expect(region.getByLabel('Your note for the writer')).toHaveValue('Tighten row 3.');
  await region.getByRole('button', { name: 'Send back to writer' }).click();
  await expect.poll(() => readFile(page, SCRIPT)).toContain('status: draft\n');
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Open comments, 0 open' }).click();
  await expect(page.getByRole('note', { name: 'Note from Sam' })).toContainText('Tighten row 3.');
  await page.getByRole('button', { name: 'History' }).click();
  const newest = page.getByRole('navigation', { name: 'Versions' }).getByRole('button').nth(0);
  await expect(newest).toContainText('Sent back to writer');
  await expect(newest).toContainText('Tighten row 3.');
});

test('typing redoes only the marks of the field typed in, once it pauses (PF-5)', async ({ page }) => {
  await open(page, [ANA, SUGGEST]);
  await expect.poll(() => marked(page).then((m) => m.sort())).toEqual(['catch', 'sunlit leaf']);
  // Keep the marks as they are, to see what typing replaces.
  await page.evaluate(() => {
    const w = window as unknown as { was: AbstractRange[]; highlight: Highlight };
    w.highlight = CSS.highlights.get('comment')!;
    w.was = [...w.highlight];
  });
  const box = page.getByLabel('Dialogue, row 3');
  await box.click();
  await box.press('Home');
  await box.pressSequentially('So, ', { delay: 50 });
  // While the keys come, nothing is redone.
  expect(await page.evaluate(() => CSS.highlights.get('comment') === (window as unknown as { highlight: Highlight }).highlight)).toBe(true);
  // After the pause, row 3's quote is found again in its new place; row 1's mark is the very same one as before.
  await expect.poll(() => page.evaluate(() => CSS.highlights.get('comment') !== (window as unknown as { highlight: Highlight }).highlight)).toBe(true);
  const kept = await page.evaluate(() => {
    const was = (window as unknown as { was: AbstractRange[] }).was;
    const now = [...CSS.highlights.get('comment')!];
    return { marks: now.every((r) => r instanceof StaticRange), kept: now.filter((r) => was.includes(r)).length };
  });
  expect(kept).toEqual({ marks: true, kept: 1 });
  await box.blur();
  await expect.poll(() => marked(page).then((m) => m.sort())).toEqual(['catch', 'sunlit leaf']);
});

test('Use in script copies a file on a comment into its row, only in Write (RV-12)', async ({ page }) => {
  // Row 1 already uses an older notes.pdf (another size), so the attached one is not "in row" and its copy gets " 2".
  const script = draft.replace('- assets/leaf-closeup.jpg', '- assets/leaf-closeup.jpg\n- assets/notes.pdf');
  const files = [{ name: 'leaf-real.png', path: '.studio/files/ana00003/leaf-real.png', size: 4 }, { name: 'notes.pdf', path: '.studio/files/ana00003/notes.pdf', size: 10 }];
  const ana = note({ id: 'ana00003', kind: 'comment', who: 'Ana', when: '2026-11-10T09:03:00Z', row: id(1), field: 'on_screen', quote: 'sunlit leaf', text: 'A real leaf, and my notes.' });
  const withFiles: [string, string] = [ana[0], JSON.stringify({ ...JSON.parse(ana[1]), files })];
  await open(page, [withFiles, ['Episode 03/.studio/files/ana00003/leaf-real.png', 'leaf'], ['Episode 03/.studio/files/ana00003/notes.pdf', 'new notes!'],
    ['Episode 03/assets/notes.pdf', 'old notes']], script);
  await page.getByRole('button', { name: 'Open comments, 1 open' }).click();
  const card = page.getByRole('complementary', { name: 'Comments' }).getByRole('article', { name: 'Comment by Ana' });

  await card.getByRole('button', { name: 'Use in script: leaf-real.png' }).click();
  await expect(card).toContainText('In row 1');
  const cell = page.locator('[data-row]').first();
  await expect(cell.getByRole('button', { name: 'Remove leaf-real.png' })).toBeAttached();
  await expect(cell).toContainText("From Ana's comment");
  await card.getByRole('button', { name: 'Use in script: notes.pdf' }).click();
  await expect(card.getByRole('button', { name: /Use in script/ })).toHaveCount(0);
  await expect.poll(() => readFile(page, SCRIPT)).toContain('- assets/notes.pdf\n- assets/leaf-push-in.mp4\n- assets/leaf-real.png\n- assets/notes 2.pdf\n');
  expect(await readFile(page, 'Episode 03/assets/leaf-real.png')).toBe('leaf');
  expect(await readFile(page, 'Episode 03/assets/notes 2.pdf')).toBe('new notes!');
  expect(await readFile(page, 'Episode 03/assets/notes.pdf')).toBe('old notes');
  // The file on the comment stays where it was.
  expect(await listFiles(page, 'Episode 03/.studio/files/ana00003')).toEqual(['leaf-real.png', 'notes.pdf']);

  // After a reload both still show "In row 1"; taking one off the row brings its button back.
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Comments' }).getByRole('article', { name: 'Comment by Ana' })).toContainText('In row 1');
  await expect(card.getByRole('button', { name: /Use in script/ })).toHaveCount(0);
  await cell.getByRole('button', { name: 'Remove leaf-real.png' }).click();
  await expect(card.getByRole('button', { name: 'Use in script: leaf-real.png' })).toBeVisible();

  // Review shows the files without the button.
  await page.getByRole('button', { name: /^Review/ }).click();
  const inReview = page.getByRole('article', { name: 'Comment by Ana' });
  await expect(inReview.getByTitle('Open notes.pdf')).toBeVisible();
  await expect(inReview.getByRole('button', { name: /Use in script/ })).toHaveCount(0);
});

const names = (cards: Locator) => cards.evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')));

test('comments are in line order, or sorted by time or type; the choice is kept for Review too (RV-16)', async ({ page }) => {
  await open(page, [BEN, SUGGEST, ANA]);
  await page.getByRole('button', { name: '1 open suggestion on row 3' }).click();
  const panel = page.getByRole('complementary', { name: 'Comments' });
  const cards = panel.getByRole('article');
  const sort = panel.getByRole('group', { name: 'Sort comments' });
  await expect(sort.getByRole('button', { name: 'Line' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => names(cards)).toEqual(['Comment by Ana', 'Suggestion by Ana', 'Comment by Ben']);

  await sort.getByRole('button', { name: 'Time' }).click();
  await expect.poll(() => names(cards)).toEqual(['Comment by Ben', 'Suggestion by Ana', 'Comment by Ana']);

  await sort.getByRole('button', { name: 'Type' }).click();
  await expect.poll(() => names(cards)).toEqual(['Suggestion by Ana', 'Comment by Ana', 'Comment by Ben']);
  await expect(panel.getByRole('heading', { level: 3 })).toHaveText(['Suggestions · 1', 'On words · 1', 'On a whole row · 1']);

  // Review opens with the same choice.
  await page.getByRole('button', { name: /^Review/ }).click();
  const aside = page.getByRole('complementary', { name: 'Comments' });
  await expect(aside.getByRole('group', { name: 'Sort comments' }).getByRole('button', { name: 'Type' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => names(aside.getByRole('article'))).toEqual(['Suggestion by Ana', 'Comment by Ana', 'Comment by Ben']);
  await aside.getByRole('button', { name: 'Line' }).click();
  await expect.poll(() => names(aside.getByRole('article'))).toEqual(['Comment by Ana', 'Suggestion by Ana', 'Comment by Ben']);
  await expect(aside.getByRole('heading', { name: /^Suggestions/ })).toHaveCount(0);
});
