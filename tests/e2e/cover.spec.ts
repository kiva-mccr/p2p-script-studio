import { expect, test, type Page } from './base';
import { globSync, readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';

// Feedback's Cover on every screen (AP-65): it hides only what is marked as the script's or a person's, so the app's
// own words always show. The example (AP-33) is opened and each screen, tab, panel and menu is checked in feedback
// mode with `window.studioCoverPlan` (what Cover would hide and show of the words on screen): no word of the example's
// script, comments, files or people may show, and nothing hidden may be the app's own.

const DIR = 'docs/example/Episode 03 - How Photosynthesis Works';
const read = (p: string) => readFileSync(p, 'utf8');
const exampleTs = read('src/lib/example.ts');

// Everything the example puts in the folder: its scripts and plan without the format's own words, and the strings
// src/lib/example.ts writes (comments, notes, people, the changes in Sam's version).
const content = [read(`${DIR}/script.md`), read(`${DIR}/plan.md`), read('docs/example/Template - Science explainer/script.md')]
  .join('\n')
  .split('\n')
  .filter((l) => !/^(---|## \d|Dialogue:|On screen:|Files:|Timeline:|Speaker:|title:|status:|authors:)/.test(l.trim()))
  .join('\n');
const literals: string[] = [];
(function strings(node: ts.Node) {
  if (ts.isStringLiteralLike(node)) literals.push(node.text);
  ts.forEachChild(node, strings);
})(ts.createSourceFile('example.ts', exampleTs, ts.ScriptTarget.Latest));
const files = [...readdirSync(`${DIR}/assets`), 'leaf-from-my-garden.jpg'];
const texts = files.filter((f) => f.endsWith('.txt')).map((f) => read(`${DIR}/assets/${f}`));
// A file's name shows changed too: an .svg drawn as zoom-sketch.png, a video's leaf-push-in-last-frame.png.
const stems = files.map((f) => f.replace(/\.[^.]+$/, ''));
const people = [...exampleTs.matchAll(/name: '(\w+)', role: '([^']+)'/g)];
const names = people.map((m) => m[1]);
const corpus = [content, ...literals, ...files, ...texts, ...people.map((m) => m[2])].join('\n').replace(/\s+/g, ' ').toLowerCase();

// Words that give the script away if they show: the people's names, its files, and its longer words that the app
// never uses itself (the app's own text is everything in src/ but the example).
const appText = globSync('src/**/*.{svelte,ts}').filter((p) => !p.endsWith('example.ts')).map(read).join('\n').toLowerCase();
const words = [...new Set([content, ...literals, ...texts].join('\n').match(/[A-Za-z]{5,}/g) ?? [])].filter((w) => !new RegExp(`\\b${w.toLowerCase()}\\b`).test(appText));
const giveaways = (text: string) => [
  ...names.filter((n) => new RegExp(`\\b${n}\\b`).test(text)),
  ...stems.filter((f) => text.includes(f)),
  ...words.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(text)),
];
// A hidden piece is the script's when it gives something away or is a piece of what the example wrote (a quote cut
// short ends in …); one or two characters are pieces of a formula (KaTeX draws each on its own).
const theScripts = (text: string) => giveaways(text).length > 0 || text.length <= 2 || corpus.includes(text.replace(/…$/, '').trim().toLowerCase());

test.use({ actionTimeout: 5000 });

type Words = { text: string; file: string };
type Plan = { hidden: Words[]; shown: Words[] };
const problems: string[] = [];

async function check(page: Page, screen: string, feedback = true) {
  if (feedback) {
    await page.getByRole('button', { name: 'Help and version' }).first().click();
    await page.getByRole('menuitem', { name: 'Feedback…' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'click the part' })).toBeVisible();
  }
  const plan: Plan = await page.evaluate(() => (window as unknown as { studioCoverPlan: () => Plan }).studioCoverPlan());
  expect(plan.shown.length + plan.hidden.length, `${screen} has words on it`).toBeGreaterThan(0);
  for (const { text, file } of plan.shown) for (const g of giveaways(text)) problems.push(`${screen}, ${file}: shows "${g}" in "${text}"`);
  for (const { text, file } of plan.hidden) if (!theScripts(text)) problems.push(`${screen}, ${file}: hides the app's own "${text}"`);
  if (feedback) await page.locator('[data-feedback-ui]').getByRole('button', { name: 'Stop' }).dispatchEvent('click');
}

async function more(page: Page, item: string) {
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: item }).click();
}

test('Cover hides the script and names on every screen, and none of the app\'s own words', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto('./');
  await check(page, 'First time');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await expect(page.getByText('Example script.')).toBeVisible();
  await check(page, 'List');
  await page.getByRole('button', { name: /^New script/ }).click();
  await check(page, 'List, new script menu', false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'People' }).click();
  await check(page, 'People', false);
  await page.keyboard.press('Escape');

  await page.getByText('How Photosynthesis Works').first().click();
  await expect(page.getByText('Every leaf you have ever seen').first()).toBeVisible();
  await check(page, 'Write');
  await page.getByRole('button', { name: /^Timeline/ }).first().click();
  await check(page, 'Write, timeline open');
  await page.getByRole('button', { name: /^Row 3 · / }).click();
  await check(page, 'Write, a row picked on the timeline');
  await page.getByRole('button', { name: 'Open planning' }).click();
  await check(page, 'Write, planning');
  await page.getByRole('button', { name: /^Comments · / }).click();
  await check(page, 'Write, comments');
  await page.getByRole('button', { name: 'Close comments' }).click();
  await page.getByRole('button', { name: /· 3 h ago$/ }).click();
  await check(page, 'Write, who was here', false);
  await page.keyboard.press('Escape');
  await more(page, 'Find and replace');
  await page.getByRole('search').getByRole('textbox').first().fill('leaf');
  await check(page, 'Write, find');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Export / Share' }).click();
  await check(page, 'Write, export and share menu', false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '+ Add' }).first().click();
  await page.getByRole('button', { name: 'Reuse a file…' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(500);
  await check(page, 'Write, reuse a file', false);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^Review/ }).click();
  await check(page, 'Review');
  await page.getByRole('button', { name: 'Approve' }).click();
  await check(page, 'Review, still open before Approve', false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Send back to writer' }).click();
  await check(page, 'Review, send back', false);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /On hold · / }).click();
  await page.getByRole('button', { name: /Resolved · / }).click();
  await check(page, 'Review, on hold and resolved comments');

  await page.getByRole('button', { name: 'History', exact: true }).click();
  await check(page, 'History');
  await page.locator('button.entry').nth(2).click();
  await check(page, 'History, an older version');

  await page.getByRole('button', { name: /^Assets/ }).click();
  await check(page, 'Assets');

  for (const [what, item] of [['Print', 'Print…'], ['Fountain', 'Fountain (.fountain)'], ['Final Draft', 'Final Draft (.fdx)'],
    ['Voice-over', 'Voice-over (.mp3, .wav)'], ['Resolve / Premiere', 'Resolve / Premiere (.zip)'], ['Video', 'Video (.mp4)']]) {
    await page.getByRole('button', { name: 'Export / Share' }).click();
    await page.getByRole('button', { name: item }).click();
    await page.waitForTimeout(500);
    await check(page, `Export, ${what}`);
    await page.getByRole('button', { name: 'Back to the script' }).click();
    await expect(page.getByRole('button', { name: 'Export / Share' })).toBeVisible();
  }

  await page.getByRole('button', { name: /^Write/ }).first().click();
  await more(page, 'Credits');
  await check(page, 'Credits', false);
  await page.keyboard.press('Escape');
  await more(page, 'Settings');
  await check(page, 'Settings', false);
  await page.keyboard.press('Escape');
  await more(page, 'Teleprompter');
  await check(page, 'Teleprompter');
  await page.goto('./#for-it');
  await expect(page.getByRole('heading', { name: 'Where the data goes' })).toBeVisible();
  await check(page, 'For IT');

  expect(problems).toEqual([]);
});
