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

const CONTROL = 'button, a, input, textarea, select, summary, [role="button"], [role="tab"], [contenteditable="true"]';

/** The part a click means: the button or box it is in (not the icon's drawing inside a button), else what it hit. */
export function partOf(target: Element): Element {
  const outside = target.closest('svg')?.parentElement ?? target;
  return target.closest(CONTROL) ?? outside;
}

/** A short name for what was clicked, from its own label (never the script's words in a text box). */
export function partLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const kind = tag === 'textarea' || el.getAttribute('contenteditable') === 'true' ? 'text box'
    : tag === 'a' ? 'link' : tag === 'input' ? `${(el as HTMLInputElement).type || 'text'} box`
      : el.getAttribute('role') || tag;
  const named = el.getAttribute('aria-label') || el.getAttribute('title')
    || (el.id && el.ownerDocument.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent)
    || (/^(button|label|summary|th|option|h[1-6])$/.test(tag) || el.getAttribute('role') === 'tab' ? el.textContent : '')
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

// Kept clear of blurring: the app's own controls, whose words are the app's, not the script's.
const CONTROLS = 'button, [role="button"], [role="tab"], label, select, option, summary, th';

/** Blurs the words in a copy of the page (the picture's): every element with its own text, but the app's controls
 * outside rows. */
export function blurWords(root: Element) {
  const all = [root, ...root.querySelectorAll('*')];
  for (const el of all) {
    if (!('style' in el)) continue; // the copy's elements may come from another document, so no instanceof
    const h = el as HTMLElement;
    const typed = h.tagName === 'TEXTAREA' || (h.tagName === 'INPUT' && !/^(checkbox|radio|range|button|submit)$/.test((h as HTMLInputElement).type));
    const own = [...h.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim());
    const control = h.closest(CONTROLS);
    // In a row, a control's own words are the script's (a file's name), unless it is an icon named by aria-label.
    const scripted = !control || (!!h.closest('[data-row]') && !control.hasAttribute('aria-label'));
    if (typed || h.getAttribute('contenteditable') === 'true' || (own && scripted)) h.style.filter = 'blur(4px)';
  }
}
