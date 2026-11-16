// Ctrl+Z and Ctrl+Y in Write: every change this person makes to the script is a step that can be undone and redone,
// in order, whatever made it (typing, Replace all, a move, a delete, the timeline). Steps are kept as the page's text
// before and after, so taking one back is folding its change backwards into the page as it is now (`lib/changes.ts`):
// what others saved since stays.

import { diff, fold } from './changes';
import { parseScript, type Block, type Row, type Script } from './script';

type Step = { before: string; after: string };
// A change outside the script's text (a take, a flag, UX-15): how to take it back and do it again. `row`: its row's id.
export type Act = { back: () => Promise<unknown>; again: () => Promise<unknown>; row?: string };
type Item = Step | { act: Act };
// Where a step landed, for the cursor: the block's index and the box, and where in it the change ends.
export type Place = { index: number; field: 'dialogue' | 'onScreen' | 'title' | null; at: number };

export class Steps {
  #undo: Item[] = [];
  #redo: Item[] = [];
  #at: string | null = null; // the page's text after the last step (or as opened, or as others' saves left it)
  #key: unknown = null; // the box being typed in, while its typing is one step
  #time = 0;

  // pause: typing in the same box with no longer gap than this is one step. limit: how many steps are kept.
  constructor(readonly pause = 1000, readonly limit = 300) {}

  // A script opened: nothing to undo yet.
  reset(text: string) {
    this.#undo = [];
    this.#redo = [];
    this.#at = text;
    this.#key = null;
  }

  // The page changed, but not by this person (someone else's save, a save adding this person to the authors, a
  // status change): later steps start from here, and undoing an earlier one leaves this change in.
  sync(text: string) {
    this.#at = text;
    this.#key = null;
  }

  // A change this person made, now in the page. `key` is the box typed in: more typing there soon after is the same step.
  note(text: string, key?: unknown) {
    if (this.#at === null) return void (this.#at = text);
    if (text === this.#at) return;
    const now = Date.now();
    const top = this.#undo.at(-1);
    if (key != null && key === this.#key && top && 'after' in top && now - this.#time < this.pause) top.after = text;
    else {
      this.#undo.push({ before: this.#at, after: text });
      if (this.#undo.length > this.limit) this.#undo.shift();
    }
    this.#redo = [];
    this.#at = text;
    this.#key = key ?? null;
    this.#time = now;
  }

  // A take or flag changed: a step too, in the same order as the text's.
  act(act: Act) {
    this.#undo.push({ act });
    if (this.#undo.length > this.limit) this.#undo.shift();
    this.#redo = [];
    this.#key = null;
  }

  // The newest step, if it is this act (the Undo toast's button takes it back through here, so the two agree).
  isLast(act: Act) {
    const top = this.#undo.at(-1);
    return !!top && 'act' in top && top.act === act;
  }

  get canUndo() {
    return this.#undo.length > 0;
  }

  get canRedo() {
    return this.#redo.length > 0;
  }

  // The page's text with the last step taken back, an act to run, null with nothing to undo, or 'clash' when someone
  // else has since changed the same place (that step is dropped: undoing it would undo their words).
  undo(now: string): string | Act | null | 'clash' {
    return this.#move(this.#undo, this.#redo, now, 'before', 'after');
  }

  redo(now: string): string | Act | null | 'clash' {
    return this.#move(this.#redo, this.#undo, now, 'after', 'before');
  }

  #move(from: Item[], to: Item[], now: string, goal: 'before' | 'after', start: 'before' | 'after') {
    const step = from.pop();
    if (!step) return null;
    if ('act' in step) {
      to.push(step);
      this.#key = null;
      return step.act;
    }
    const text = turn(step[start], step[goal], now);
    if (text === null) return 'clash';
    to.push(step);
    this.#at = text;
    this.#key = null;
    return text;
  }
}

// `now` with the change from `from` to `to` folded in, or null where it clashes with a later change.
function turn(from: string, to: string, now: string): string | null {
  if (now === from) return to;
  const delta = diff(from, to);
  if (!delta) return now;
  const merged = fold(delta, now);
  return merged.clashes.length ? null : merged.text({});
}

const FIELDS = ['dialogue', 'onScreen', 'files', 'timeline', 'note'] as const;

// Puts `text` into the page in place: rows and sections that stay keep their objects (so their boxes, and the cursor,
// stay), and only what differs is set (a space typed at the end of a box, which the file doesn't keep, stays).
// Returns where the change is, for the cursor, or null if nothing changed.
export function settle(script: Script, nowText: string, text: string): Place | null {
  const delta = diff(nowText, text);
  if (!delta) return null;
  const target = parseScript(text);
  if (delta.front) script.front = delta.front[1];
  if (delta.intro) script.intro = delta.intro[1];
  const rowsNow = new Map(script.blocks.flatMap((b) => (b.type === 'row' ? [[b.id, b] as const] : [])));
  let place: Place | null = null;
  for (const [id, [was, then]] of Object.entries(delta.rows)) {
    const row = rowsNow.get(id);
    if (!was || !then || !row) continue;
    for (const field of FIELDS) {
      if (JSON.stringify(was[field]) === JSON.stringify(then[field])) continue;
      if (field === 'files') row.files = [...then.files];
      else row[field] = then[field];
    }
  }
  if (delta.layout) {
    const used = new Set<Block>();
    const sections = script.blocks.filter((b) => b.type === 'section');
    script.blocks = target.blocks.map((block, i) => {
      if (block.type === 'row') return rowsNow.get(block.id) ?? block;
      // A section at the same place, or one with the same title elsewhere, keeps its object; a new one is new.
      const here = script.blocks[i];
      const same = here?.type === 'section' && !used.has(here) ? here : sections.find((s) => !used.has(s) && s.title === block.title && s.note === block.note);
      if (!same) return block;
      used.add(same);
      if (same.type === 'section') [same.title, same.note] = [block.title, block.note];
      return same;
    });
  }
  // The cursor: the first block, in reading order, that changed.
  const before = parseScript(nowText);
  const old = new Map(before.blocks.flatMap((b) => (b.type === 'row' ? [[b.id, b] as const] : [])));
  target.blocks.some((block, i) => {
    if (block.type === 'section') {
      const was = before.blocks[i];
      if (was?.type === 'section' && was.title === block.title && was.note === block.note) return false;
      place = { index: i, field: 'title', at: ends(was?.type === 'section' ? was.title : '', block.title) };
      return true;
    }
    const was = old.get(block.id);
    if (!was) return (place = { index: i, field: 'dialogue', at: block.dialogue.length }), true;
    for (const field of ['dialogue', 'onScreen'] as const) {
      if (was[field] !== block[field]) return (place = { index: i, field, at: ends(was[field], block[field]) }), true;
    }
    if (!sameRow(was, block) || before.blocks[i] !== was) return (place = { index: i, field: null, at: 0 }), true;
    return false;
  });
  return place ?? { index: Math.min(target.blocks.length - 1, Math.max(0, firstMoved(before.blocks, target.blocks))), field: null, at: 0 };
}

const sameRow = (a: Row, b: Row) => FIELDS.every((f) => JSON.stringify(a[f]) === JSON.stringify(b[f]));

// Where the new words end: after what differs from the old, so the cursor sits just after the change.
function ends(was: string, now: string): number {
  let tail = 0;
  while (tail < was.length && tail < now.length && was[was.length - 1 - tail] === now[now.length - 1 - tail]) tail++;
  let head = 0;
  while (head < was.length - tail && head < now.length - tail && was[head] === now[head]) head++;
  return Math.max(head, now.length - tail);
}

// The first place the blocks' order differs (a row deleted, so nothing to point at but where it was).
function firstMoved(was: Block[], now: Block[]): number {
  const key = (b: Block | undefined) => (b?.type === 'row' ? b.id : b ? `s:${b.title}` : '');
  let i = 0;
  while (i < was.length && i < now.length && key(was[i]) === key(now[i])) i++;
  return i;
}
