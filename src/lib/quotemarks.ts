import { rangeOf } from './format';
import type { Thread } from './comments';

// The open comments' quotes marked yellow in Write (RV-13), kept per field so typing redoes only what changed (PF-5).
// Each field's marks are kept with the drawn text they were found in (its `.shown` element, first node and text);
// a build reuses them while all three still match, and finds the quotes again only in the fields that changed.
// Marks are StaticRanges: unlike Ranges, the page doesn't keep them up to date on every change, so old ones cost
// nothing once they are replaced.
type Field = { shown: HTMLElement; first: Node | null; text: string; marks: Map<string, StaticRange> };

export class QuoteMarks {
  #fields = new Map<string, Field>(); // "row field" → its marks
  #timer: ReturnType<typeof setTimeout> | undefined;
  #stopped = false;
  #table: () => HTMLElement | undefined;
  #list: () => Thread[];
  #on: () => string;
  readonly wait: number;

  // table: Write's rows; list: the open comments; on: the one being read (marked brighter); wait: the pause in ms.
  constructor(table: () => HTMLElement | undefined, list: () => Thread[], on: () => string, wait = 400) {
    [this.#table, this.#list, this.#on, this.wait] = [table, list, on, wait];
  }

  // Look again now (the comments, the columns drawn or the rows' order changed).
  now() {
    clearTimeout(this.#timer);
    if (!this.#stopped) this.#build();
  }

  // Look again once typing has paused (a field's text changed).
  soon() {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => this.#build(), this.wait);
  }

  // Mark the one being read brighter, with the marks already found.
  paint() {
    if (this.#stopped) return;
    const on = this.#on();
    const marks: StaticRange[] = [];
    const onMark: StaticRange[] = [];
    for (const field of this.#fields.values()) for (const [id, range] of field.marks) (id === on ? onMark : marks).push(range);
    CSS.highlights.set('comment', new Highlight(...marks));
    CSS.highlights.set('comment-on', new Highlight(...onMark));
  }

  // Leaving Write: nothing more is marked, and a look waiting for a pause is dropped (Review uses the same names).
  stop() {
    this.#stopped = true;
    clearTimeout(this.#timer);
    this.#fields.clear();
    ['comment', 'comment-on'].forEach((name) => CSS.highlights.delete(name));
  }

  #build() {
    const table = this.#table();
    if (!table || this.#stopped) return;
    const groups = new Map<string, Thread[]>();
    for (const t of this.#list()) {
      const { row, field, quote } = t.comment;
      if (!quote || !row || field === 'files') continue;
      const key = `${row} ${field === 'on_screen' ? 'screen' : 'dialogue'}`;
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    const fields = new Map<string, Field>();
    for (const [key, threads] of groups) {
      const [row, column] = key.split(' ');
      const shown = table.querySelector<HTMLElement>(`[data-row="${row}"] .${column} .shown`);
      if (!shown) continue; // folded away, or the row is gone
      const was = this.#fields.get(key);
      const text = shown.textContent ?? '';
      const same = was && was.shown === shown && was.first === shown.firstChild && was.text === text;
      // Unchanged text keeps its marks (a comment closed since drops its own); only new comments are looked for.
      const ids = new Set(threads.map((t) => t.comment.id));
      const marks = new Map(same ? [...was.marks].filter(([id]) => ids.has(id)) : []);
      for (const t of threads) {
        if (marks.has(t.comment.id)) continue;
        const range = rangeOf(shown, t.comment.quote!);
        if (range) marks.set(t.comment.id, new StaticRange(range));
      }
      fields.set(key, { shown, first: shown.firstChild, text, marks });
    }
    this.#fields = fields;
    this.paint();
  }
}
