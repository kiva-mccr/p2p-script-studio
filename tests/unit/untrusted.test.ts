import { describe, expect, it } from 'vitest';
import katex from 'katex';
import { showLists, toHtml } from '../../src/lib/format';
import { parseScript, readFileRef, type Row } from '../../src/lib/script';
import { share, type Facts } from '../../src/lib/share';
import { shownType } from '../../src/lib/openfile';
import { toFdx } from '../../src/lib/fdx';
import { layout } from '../../src/lib/timeline';
import { EDIT, plan, toXml } from '../../src/lib/editxml';

// SE-3: anything in a script file is untrusted. These try to sneak a script, a javascript: link or an onerror
// attribute through every place script text becomes HTML or another document (OWASP ASVS V5, output encoding).

const IMG = '<img src=x onerror="window.pwned=1">';
const ATTACKS = [
  '<script>window.pwned=1</script>',
  IMG,
  `<u>${IMG}</u>`,
  `**${IMG}**`,
  `~~${IMG}~~`,
  `*${IMG}*`,
  `<u onmouseover="window.pwned=1">x</u>`,
  `[x](javascript:window.pwned=1)`,
  `[x](JaVaScRiPt:window.pwned=1)`,
  `[x](data:text/html,<script>window.pwned=1</script>)`,
  `[x](https://a.example/"onmouseover="window.pwned=1)`,
  `[x](https://a.example/'onmouseover='window.pwned=1)`,
  `[${IMG}](https://a.example/)`,
  `$"><img src=x onerror=window.pwned=1>$`,
  `<svg onload="window.pwned=1">`,
  `&lt;img src=x onerror=1&gt;`,
];

// What would make a tag or an attribute in HTML: an unescaped < or a quote that ends an attribute early.
function safe(html: string): void {
  const tags = [...html.matchAll(/<([a-z]+)([^>]*)>/gi)];
  for (const [tag, name, attrs] of tags) {
    expect(['strong', 'em', 'u', 's', 'a', 'span'], tag).toContain(name.toLowerCase());
    expect(attrs.replace(/="[^"]*"/g, '=""'), tag).not.toMatch(/\son[a-z]+=/i); // only what's outside the quotes counts
    if (name === 'a') expect(attrs, tag).toMatch(/^ href="https?:\/\/[^"]*" target="_blank" rel="noopener"$/);
    if (name === 'span') expect(attrs, tag).toMatch(/^ class="math" data-tex="[^"]*"$/);
  }
}

describe('formatting (toHtml)', () => {
  for (const attack of ATTACKS) {
    it(`keeps ${attack} as text`, () => {
      safe(toHtml(attack));
      safe(toHtml(showLists(`- [ ] ${attack}\n- ${attack}`)));
    });
  }
  it('makes only http(s) links', () => {
    expect(toHtml('[x](javascript:alert(1))')).toBe('[x](javascript:alert(1))');
    expect(toHtml('[x](https://a.example/"x)')).toContain('href="https://a.example/&quot;x"');
  });
});

describe('equations (KaTeX, as renderMath runs it)', () => {
  const render = (tex: string) => katex.renderToString(tex, { throwOnError: false });
  it('refuses commands that make links, pictures or attributes', () => {
    for (const tex of ['\\href{javascript:window.pwned=1}{x}', '\\url{javascript:window.pwned=1}', '\\includegraphics{https://a.example/x.png}',
      '\\htmlData{onerror=window.pwned=1}{x}', '\\htmlId{x}{y}', '\\htmlClass{x}{y}', '\\htmlStyle{color:red}{y}']) {
      const html = render(tex);
      expect(html, tex).not.toMatch(/<a |<img |href=|src=|data-onerror|id="x"|class="x"/); // shown as red text instead
    }
  });
  it('keeps < and quotes in an equation as text', () => {
    expect(render('x<y "><img src=x onerror=1>')).not.toContain('<img');
  });
});

describe('files column (readFileRef)', () => {
  it('only http(s) addresses are links; any other scheme is words', () => {
    for (const line of ['[x](javascript:window.pwned=1)', '[x](JAVASCRIPT:window.pwned=1)', '[x](data:text/html,<script>1</script>)',
      '[x](vbscript:msgbox)', '[x](file:///C:/Windows/evil.exe)', 'javascript:window.pwned=1']) {
      expect(readFileRef(line).kind, line).toBe('words');
    }
    expect(readFileRef('[Clip](HTTPS://a.example/clip.mp4)')).toEqual({ kind: 'link', label: 'Clip', target: 'HTTPS://a.example/clip.mp4' });
  });
});

describe('opening a file (openFile)', () => {
  it('opens pictures, PDFs, text, video and sound in a tab with a fixed type; pages and SVG download', () => {
    expect(shownType('assets/leaf.JPG')).toBe('image/jpeg');
    expect(shownType('notes.md')).toBe('text/plain;charset=utf-8');
    for (const name of ['evil.html', 'evil.htm', 'evil.svg', 'evil.xml', 'evil.xhtml', 'evil.mht', 'evil.js', 'evil', 'evil.png.html']) {
      expect(shownType(name), name).toBeNull();
    }
  });
});

describe('Copy for Teams (share)', () => {
  const facts: Facts = { title: IMG, link: 'https://a.example/#/x', status: IMG, version: IMG, who: IMG, when: 1, open: 0, voice: 0 };
  it('escapes everything that came from the script, the status and version too', () => {
    const script = parseScript(`---\ncredits: [{"id": "p1", "name": "${IMG.replace(/"/g, '\\"')}", "role": "x"}]\n---\n\n## 1\nDialogue: Hi\n`);
    const { html } = share(facts, script);
    expect(html).not.toMatch(/<img|<script/);
    expect([...html.matchAll(/<([a-z]+)/g)].map((m) => m[1]).filter((t) => !['p', 'a', 'b', 'br'].includes(t))).toEqual([]);
  });
});

describe('exports', () => {
  const source = `---\ntitle: ${IMG}\ncredits: [{"id": "p1", "name": "Eve", "role": "x", "as": "Eve ]]> <x/>"}]\n---\n\n# ${IMG}\n\n## 1 <!-- id: aaaaa -->\nSpeaker: Eve ]]> <x/>\nDialogue:\n${ATTACKS.join('\n')}\n\nOn screen:\n${IMG}\n\nFiles:\n- assets/${IMG}.png\n- [${IMG}](https://a.example/x.mp4)\n`;
  const script = parseScript(source);
  it('Final Draft (.fdx) escapes every text', () => {
    const xml = toFdx(script, IMG, IMG, IMG);
    expect(xml).not.toMatch(/<img|<script|<svg|<x\/>|<u/);
  });
  it('Resolve / Premiere (FCP7 XML) escapes names and markers', () => {
    const laid = layout(script, (row: Row) => ({ seconds: 3, take: row.id === 'aaaaa' }));
    const xml = toXml(plan(script, laid, EDIT), IMG, EDIT);
    expect(xml).not.toMatch(/<img|<script|<svg|<x\/>/);
  });
});
