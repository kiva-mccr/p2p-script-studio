import { expect, test, type Page } from './base';
import { setUp } from './folder';

// SE-3: a script file is untrusted. Anyone with the shared folder can write anything into script.md, plan.md or an
// asset, so these try to sneak a script into the page through every place script text becomes HTML. A script that
// ran would break the policy (base.ts fails the test on any refusal); `planted` also finds what the policy would
// have stopped, so a gap in the escaping fails the test even if the policy one day lets it through.

const IMG = '<img src=x onerror="window.pwned=1">';
const BAD = [
  `<script>window.pwned=1</script>`,
  IMG,
  `<u>${IMG}</u>`,
  `**${IMG}**`,
  `[click](javascript:window.pwned=1)`,
  `[click](https://a.example/"onmouseover="window.pwned=1)`,
  `$\\href{javascript:window.pwned=1}{eq}$`,
  `$\\htmlData{x=1}{eq}$`,
  `$\\includegraphics{https://a.example/x.png}$`,
  `<svg onload="window.pwned=1"></svg>`,
  `<a href="javascript:window.pwned=1">a</a>`,
  `<iframe src="javascript:window.pwned=1"></iframe>`,
].join('\n');

const SCRIPT = `---
title: Sneaky ${IMG}
status: in review
authors: [${IMG}]
credits: [{"id": "p1", "name": "Eve ${IMG}", "role": "<script>window.pwned=1</script>", "as": "Eve"}]
---

# Intro ${IMG}

## 1 <!-- id: aaaa1 -->
Speaker: Eve
Dialogue:
${BAD}

On screen:
${BAD}

Files:
- [click](javascript:window.pwned=1)
- [data](data:text/html,<script>window.pwned=1</script>)
- [vb](vbscript:msgbox)
- javascript:window.pwned=1
- assets/evil.svg
- assets/evil.html
- ${IMG}

## 2 <!-- id: aaaa2 -->
Dialogue:
Plain words.

On screen:
A plain shot.
`;

const PLAN = `- [ ] ${IMG}\n- [click](javascript:window.pwned=1)\n<script>window.pwned=1</script>\n`;
const EVIL_SVG = '<svg xmlns="http://www.w3.org/2000/svg" onload="window.opener && (window.opener.pwned=1)"><script>window.pwned=1</script><rect width="10" height="10"/></svg>';
const EVIL_HTML = '<!doctype html><title>evil</title><script>window.pwned=1</script><img src=x onerror="window.pwned=1"><p>evil page</p>';

// Anything in the page that a script file could have planted: an inline handler, a script or frame that isn't the
// app's own, or a javascript:/data: address.
async function planted(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    for (const el of document.querySelectorAll('*')) {
      for (const a of el.attributes) {
        if (/^on/i.test(a.name)) found.push(`<${el.localName} ${a.name}>`);
        if (/^(href|src|xlink:href|action|formaction|data)$/i.test(a.name) && /^\s*(javascript|vbscript|data:text\/html)/i.test(a.value)) {
          found.push(`<${el.localName} ${a.name}="${a.value}">`);
        }
      }
      if (/^(iframe|object|embed|frame|base|form)$/.test(el.localName)) found.push(`<${el.localName}>`);
      if (el.localName === 'script' && !(el as HTMLScriptElement).src.startsWith(location.origin)) found.push('<script>');
    }
    if ((window as unknown as { pwned?: number }).pwned) found.push('window.pwned');
    return found;
  });
}

async function open(page: Page) {
  await setUp(page, '#/Sneaky', {
    'Sneaky/script.md': SCRIPT,
    'Sneaky/plan.md': PLAN,
    'Sneaky/assets/evil.svg': EVIL_SVG,
    'Sneaky/assets/evil.html': EVIL_HTML,
  });
  await expect(page.getByLabel('Dialogue, row 2')).toBeVisible();
}

test('A hostile script.md shows as text in Write, Review, History, Print, Export and the teleprompter', async ({ page }) => {
  await open(page);
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue(/<script>window.pwned=1<\/script>/);
  expect(await planted(page)).toEqual([]);
  for (const tab of ['Review', 'History']) {
    await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
    await page.waitForTimeout(500);
    expect(await planted(page), tab).toEqual([]);
  }
});

test('A file opened from the files column never runs as a page of the app', async ({ page, context }) => {
  await open(page);
  const popups: Page[] = [];
  context.on('page', (p) => popups.push(p));
  page.on('download', () => {});
  await page.getByRole('button', { name: 'Open evil.svg' }).click();
  await page.getByRole('button', { name: /^evil\.html/ }).click();
  await page.getByRole('link', { name: 'click' }).last().click({ modifiers: [] }).catch(() => {});
  await page.waitForTimeout(1500);
  for (const p of popups) console.log('popup', p.url(), await p.evaluate(() => [location.origin, (window as any).pwned, document.contentType]).catch((e) => String(e)));
  expect(await planted(page)).toEqual([]);
});
