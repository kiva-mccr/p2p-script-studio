// Feedback mode (AP-48): what the clicked part is, and the GitHub issue that carries it. Built so the issue can be acted
// on straight away: the part's name, the .svelte file it is written in (`data-c`, lib/marks.ts), a selector, the row
// and column, the screen, the live version, the browser and window size. Nothing from the script unless allowed.

import { browserName } from './problems';
import { versionLabel, type Version } from './version';

export const ISSUES = 'https://github.com/kiva-mccr/p2p-script-studio/issues/new';

export interface Part {
  label: string; // what the person sees it as: 'button "Record row 3"'
  file: string; // 'WriteRow.svelte', or '' if unknown
  tour: string; // the nearest data-tour mark, or ''
  selector: string;
  row: number | null;
  column: string;
  screen: string; // 'Write', 'Review', 'History', 'Script list', 'Settings'…
}

const COLUMNS: [string, string][] = [
  ['.dialogue, [data-field="dialogue"]', 'Dialogue'],
  ['.screen, [data-field="on_screen"]', 'On screen'],
  ['.files, [data-field="files"]', 'Images and files'],
  ['.mic-cell', 'the mic'],
  ['.num', 'the row number'],
];

const CONTROL = 'button, a, input, textarea, select, summary, [role="button"], [role="tab"], [role="scrollbar"], [contenteditable="true"]';

/** The part a click means: the button or box it is in (not the icon's drawing inside a button), else what it hit. */
export function partOf(target: Element): Element {
  const outside = target.closest('svg')?.parentElement ?? target;
  return target.closest(CONTROL) ?? outside;
}

/** Whether a press at (x, y) is on `el`'s own scroll bar (issue #252): the browser drags a scroll bar whatever the page
 *  says, and sends no click for it. The page's own scroll bar is left alone, to reach the parts below. */
export function onScrollbar(el: Element, x: number, y: number): boolean {
  if (!(el instanceof HTMLElement) || el === document.documentElement || el === document.body) return false;
  const css = getComputedStyle(el);
  // Only a box that scrolls has a bar: an inline span (a file's name in its chip, issue #257) has a clientWidth of 0.
  if (!/auto|scroll|overlay/.test(`${css.overflowX} ${css.overflowY}`)) return false;
  const side = el.offsetWidth - el.clientWidth - el.clientLeft - parseFloat(css.borderRightWidth); // 0 without a bar
  const below = el.offsetHeight - el.clientHeight - el.clientTop - parseFloat(css.borderBottomWidth);
  if (side < 1 && below < 1) return false; // an SVG drawing or a plain box has no bar (clientWidth 0 or all of it)
  const r = el.getBoundingClientRect();
  const inX = x - r.left - el.clientLeft, inY = y - r.top - el.clientTop;
  if (inX < 0 || inY < 0) return false;
  return (side >= 1 && inX >= el.clientWidth && inX < el.clientWidth + side)
    || (below >= 1 && inY >= el.clientHeight && inY < el.clientHeight + below);
}

/** A short name for what was clicked, from its own label (never the script's words in a text box). */
export function partLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const role = el.getAttribute('role');
  const kind = role === 'menuitem' ? 'menu item' : tag === 'textarea' || el.getAttribute('contenteditable') === 'true' ? 'text box'
    : tag === 'a' ? 'link' : tag === 'input' ? `${(el as HTMLInputElement).type || 'text'} box`
      : role || tag;
  const named = el.getAttribute('aria-label') || el.getAttribute('title')
    || (el.id && el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent)
    || (/^(button|label|summary|th|option|h[1-6])$/.test(tag) || /^(tab|menuitem|option)$/.test(role ?? '') ? el.textContent : '')
    || el.getAttribute('placeholder') || '';
  const name = named.replace(/\s+/g, ' ').trim().slice(0, 60);
  // A file's name or path (a file in a row: "leaf.jpg", "../Assets/x.png") is the script's, so it's left out.
  if (/\.[a-z0-9]{2,4}\b|\//i.test(name)) return `${kind} (a file)`;
  return name ? `${kind} "${name}"` : kind;
}

/** A selector that finds it again: from the nearest marked parent (an id, a row, a data-tour used once) down, at most 5 steps. */
export function selectorOf(el: Element): string {
  const steps: string[] = [];
  for (let e: Element | null = el; e && e.tagName !== 'BODY' && steps.length < 5; e = e.parentElement) {
    const tour = e.getAttribute('data-tour');
    const row = e.getAttribute('data-row');
    if (e.id) { steps.unshift(`#${CSS.escape(e.id)}`); break; }
    if (row && e !== el) { steps.unshift(`[data-row="${row}"]`); break; }
    const once = tour && el.ownerDocument.querySelectorAll(`[data-tour="${tour}"]`).length === 1;
    if (once && e !== el) { steps.unshift(`[data-tour="${tour}"]`); break; }
    const classes = [...e.classList].filter((c) => !c.startsWith('svelte-')).map((c) => `.${CSS.escape(c)}`).join('');
    let step = e.tagName.toLowerCase() + classes;
    const same = e.parentElement ? [...e.parentElement.children].filter((c) => c.tagName === e!.tagName) : [];
    if (same.length > 1 && !classes) step += `:nth-of-type(${same.indexOf(e) + 1})`;
    steps.unshift(step);
  }
  return steps.join(' > ');
}

/** The row's number as the page shows it ("… row 3" in a label inside the row), or null outside a row. */
export function rowOf(el: Element): number | null {
  const row = el.closest('[data-row]');
  if (!row) return null;
  for (const e of [el, ...row.querySelectorAll('[aria-label]')]) {
    const m = /\brow (\d+)\b/i.exec(e.getAttribute('aria-label') ?? '');
    if (m) return Number(m[1]);
  }
  return null;
}

export function columnOf(el: Element): string {
  for (const [sel, name] of COLUMNS) if (el.closest(sel)) return name;
  return '';
}

/** Where it is: a window's title (Settings, Credits…), the script list, or Write · Review · History. */
export function screenOf(el: Element, hash: string): string {
  const dialog = el.closest('[role="dialog"]');
  if (dialog) {
    const by = dialog.getAttribute('aria-labelledby');
    const title = dialog.getAttribute('aria-label') || (by && el.ownerDocument.getElementById(by)?.textContent) || 'a window';
    return title.trim();
  }
  if (!/^#\/./.test(hash)) return 'Script list';
  const mode = el.ownerDocument.querySelector('nav [aria-current="page"]')?.firstChild?.textContent?.trim();
  return mode || 'Script';
}

export function describe(el: Element, hash: string): Part {
  const file = el.closest('[data-c]')?.getAttribute('data-c');
  return {
    label: partLabel(el),
    file: file ? `${file}.svelte` : '',
    tour: el.closest('[data-tour]')?.getAttribute('data-tour') ?? '',
    selector: selectorOf(el),
    row: rowOf(el),
    column: columnOf(el),
    screen: screenOf(el, hash),
  };
}

export interface Env { version: Version | null; ua: string; width: number; height: number; script?: string; page?: string }

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** The issue's title: "Feedback: button "Record row 3" (Write)". */
export function issueTitle(part: Part): string {
  return `Feedback: ${part.label} (${part.screen})`.slice(0, 100);
}

/** The issue's text, always in the same shape. `env.script` and `env.page` only when the person allowed the name. */
export function issueBody(note: string, part: Part, env: Env, picture: boolean): string {
  const where = [part.row ? `row ${part.row}` : '', part.column].filter(Boolean).join(', ');
  const code = [part.file, part.tour ? `data-tour="${part.tour}"` : ''].filter(Boolean).join(', ');
  const rows: [string, string][] = [
    ['Screen', env.page ? `${part.screen} (${env.page})` : part.screen],
    ['Part', part.label],
    ['Code', code],
    ['Selector', `\`${part.selector}\``],
    ['Row, column', where],
    ['Script', env.script ?? ''],
    ['Version', env.version ? `${versionLabel(env.version)} (${env.version.title})` : 'dev build'],
    ['Browser', `${browserName(env.ua)}, window ${env.width} × ${env.height}`],
  ];
  return [
    '**Note**',
    '',
    note.trim().slice(0, 2000) || '(no note)',
    '',
    '| | |',
    '|---|---|',
    ...rows.filter(([, v]) => v).map(([k, v]) => `| ${k} | ${cell(v)} |`),
    '',
    ...(picture ? ['**Picture**', '', '<!-- Paste the picture here: Ctrl+V -->', ''] : []),
    '_Sent with Feedback in P2P Script Studio (AP-48)._',
  ].join('\n');
}

/** GitHub's new issue page, filled in, with the `feedback` label. */
export function issueUrl(title: string, body: string): string {
  const q = new URLSearchParams({ title, body, labels: 'feedback' });
  return `${ISSUES}?${q}`;
}

/** The text "Copy instead" puts on the clipboard, for Teams or an email. */
export function plainText(title: string, body: string): string {
  return `${title}\n\n${body.replace('<!-- Paste the picture here: Ctrl+V -->', '(no picture)')}`;
}

// Kept clear of covering: the app's own controls, whose words are the app's, not the script's (unless `data-hide`).
const CONTROLS = 'button, [role="button"], [role="tab"], label, select, option, summary, th';
// Fully opaque, so nothing can be read back out of it (a blur can be undone).
// `!important`, since the copy carries each element's own styles inline.
const BOX = ['background:#a3a3a3', 'color:transparent', '-webkit-text-fill-color:transparent', 'border-radius:4px', 'text-shadow:none',
  '-webkit-box-decoration-break:clone', 'box-decoration-break:clone'].map((d) => `${d} !important`).join(';');

/** Every letter as an x, spaces kept: the box keeps the words' shape, and the real text is not in the copy at all. */
const masked = (text: string) => text.replace(/\S/g, 'x');

/** True when this element's own words are covered: the script's words, and people's names. */
function covered(el: Element): boolean {
  if (el.closest('[data-hide]')) return true; // a name, even on a button ("Ana · 3 h ago")
  if (el.closest('[data-keep]')) return false; // the app's own words outside controls ("In review", "Saved")
  if (el.closest('[contenteditable="true"]')) return true;
  // A control's own words are the app's ("Clear", "Choose a file…", issue #257); one that shows the script's words or a
  // name (a file's chip, an asset's label) holds them in a `data-hide` span.
  return !el.closest(CONTROLS);
}

/** Covers the words in a copy of the page (the picture's) with solid grey boxes: the script's words, its pictures and
 * people's names, but not the app's controls nor what is marked `data-keep`. */
export function coverWords(root: Element) {
  const doc = root.ownerDocument;
  const box = (text: string, line = false) => {
    const span = doc.createElement('span');
    // On one line that cuts off (a file's chip), the box is cut to fit instead, so its rounded ends show.
    span.setAttribute('style', BOX + (line ? ';display:inline-block;max-width:100%;overflow:hidden;vertical-align:bottom' : ''));
    span.textContent = masked(text);
    return span;
  };
  for (const el of [root, ...root.querySelectorAll('*')]) {
    if (!('style' in el)) continue; // the copy's elements may come from another document, so no instanceof
    const h = el as HTMLInputElement;
    if (/^(IMG|VIDEO|CANVAS|PICTURE|IFRAME)$/.test(h.tagName) && !h.closest('[data-keep]')) {
      // A picture (a file's preview, a video's still, the timeline's) becomes a grey box of the same size.
      const stand = doc.createElement('div');
      stand.setAttribute('style', h.getAttribute('style') ?? '');
      stand.style.setProperty('background', '#a3a3a3', 'important');
      stand.style.setProperty('border-radius', '4px', 'important');
      if (!stand.style.display || stand.style.display === 'inline') stand.style.display = 'inline-block';
      if (!stand.style.width) stand.style.width = `${(h as unknown as HTMLImageElement).width || 0}px`;
      if (!stand.style.height) stand.style.height = `${(h as unknown as HTMLImageElement).height || 0}px`;
      h.replaceWith(stand);
      continue;
    }
    const typed = h.tagName === 'TEXTAREA' || (h.tagName === 'INPUT' && !/^(checkbox|radio|range|button|submit|color|file)$/.test(h.type));
    if (!typed) continue;
    // A text box becomes a box of the same look holding its words as grey boxes, line by line.
    const stand = doc.createElement('div');
    stand.setAttribute('style', h.getAttribute('style') ?? '');
    stand.style.whiteSpace = h.tagName === 'TEXTAREA' ? 'pre-wrap' : 'pre';
    stand.style.overflow = 'hidden';
    if (h.value.trim()) stand.append(box(h.value));
    h.replaceWith(stand);
  }
  const walker = doc.createTreeWalker(root, 4 /* text */);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  for (const t of texts) {
    const parent = t.parentElement;
    if (!t.data.trim() || !parent || parent.tagName === 'STYLE' || parent.tagName === 'SCRIPT' || !covered(parent)) continue;
    t.replaceWith(box(t.data, /^(nowrap|pre)$/.test(parent.style.whiteSpace)));
  }
}

const GAP = 10;
const EDGE = 8;

/** Where the panel goes: below the part if it fits, else above, else wherever it is whole on screen (over the part
 * if it must). Never past an edge of the window. */
/** The orange ring round a part on screen, 3 px out but kept inside the window: a part as big as the window (the
 * Assets backdrop) put its ring just past every edge, so none of it showed (issue #216). */
export function ringBox(part: { left: number; top: number; right: number; bottom: number }, view: { width: number; height: number }):
  { left: number; top: number; width: number; height: number } {
  const left = Math.max(0, part.left - 3), top = Math.max(0, part.top - 3);
  const right = Math.min(view.width, part.right + 3), bottom = Math.min(view.height, part.bottom + 3);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

export function placePanel(part: { left: number; top: number; bottom: number } | null, panel: { width: number; height: number },
  view: { width: number; height: number }): { left: number; top: number } {
  const clamp = (v: number, max: number) => Math.max(EDGE, Math.min(v, max));
  const maxLeft = view.width - panel.width - EDGE;
  const maxTop = view.height - panel.height - EDGE;
  if (!part) return { left: clamp(maxLeft, maxLeft), top: clamp(maxTop, maxTop) };
  const left = clamp(part.left, maxLeft);
  if (part.bottom + GAP + panel.height <= view.height - EDGE) return { left, top: part.bottom + GAP };
  if (part.top - GAP - panel.height >= EDGE) return { left, top: part.top - GAP - panel.height };
  return { left, top: clamp(part.bottom + GAP, maxTop) };
}
