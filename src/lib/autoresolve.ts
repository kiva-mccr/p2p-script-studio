// Comments that lose their place (RV-24, issue #249, board 81): a save that deletes a row resolves the open
// comments and suggestions on it, keeping the row's words in the resolve ("Row 4, as it was when deleted"); a save
// that replaces the words a comment is on resolves it the same way, with the old and new words. A save that brings
// the row or the words back (Undo) reopens them. Nothing is lost: the resolve note holds what was there.

import { plain } from './format';
import { fieldText, type Field, type Note, type Thread } from './comments';
import { parseScript, rows, type Row } from './script';

export type Entry = Omit<Note, 'v' | 'id' | 'when'>;
const FIELDS: Field[] = ['dialogue', 'on_screen', 'files'];

// The notes `who` writes for a save from `beforeText` to `afterText`. `flat` turns a cell's text into what the page
// shows (`plain`, which needs the page; tests pass their own).
export function autoResolve(list: Thread[], beforeText: string, afterText: string, who: string, flat = plain): Entry[] {
  const before = rows(parseScript(beforeText));
  const after = new Map(rows(parseScript(afterText)).map((row) => [row.id, row]));
  const was = new Map(before.map((row, i) => [row.id, { row, i }]));
  const entries: Entry[] = [];
  for (const t of list) {
    const c = t.comment;
    if (t.deleted || !c.row) continue;
    const old = was.get(c.row)?.row;
    const now = after.get(c.row);
    const field = c.field ?? 'dialogue';
    const has = (row: Row | undefined) => !!row && !!c.quote && flat(fieldText(row, field)).includes(c.quote);
    if (!t.resolved) {
      if (old && !now) {
        const i = was.get(c.row)!.i;
        entries.push({ kind: 'resolve', about: c.id, who, why: 'deleted', was: rowWords(old, field, flat), n: i + 1, after: before[i - 1]?.id ?? '' });
      } else if (old && now && has(old) && !has(now)) {
        const [from, to] = changed(flat(fieldText(old, field)), flat(fieldText(now, field)), c.quote!);
        entries.push({ kind: 'resolve', about: c.id, who, why: 'replaced', was: from, now: to });
      }
    } else if (t.gone?.why === 'deleted' && !old && now) {
      entries.push({ kind: 'reopen', about: c.id, who });
    } else if (t.gone?.why === 'replaced' && old && now && !has(old) && has(now)) {
      entries.push({ kind: 'reopen', about: c.id, who });
    }
  }
  return entries;
}

// What a deleted row said: the comment's own column, else the first column with anything in it.
function rowWords(row: Row, field: Field, flat: (text: string) => string): string {
  for (const f of [field, ...FIELDS]) {
    const words = flat(fieldText(row, f)).trim();
    if (words) return words;
  }
  return '';
}

// The words around `quote` that changed from `old` to `now`, widened to whole words: [the old words, the new].
export function changed(old: string, now: string, quote: string): [string, string] {
  let start = 0;
  while (start < old.length && start < now.length && old[start] === now[start]) start++;
  let tail = 0;
  while (tail < old.length - start && tail < now.length - start && old[old.length - 1 - tail] === now[now.length - 1 - tail]) tail++;
  const q = old.indexOf(quote);
  let from = Math.min(start, q);
  let to = Math.max(old.length - tail, q + quote.length); // in `old`; the rest after it is the same in `now`
  // Out to whole words (not the punctuation after them), unless already at a space: the change may sit either side.
  const word = (i: number) => i >= 0 && i < old.length && /[\p{L}\p{N}'’-]/u.test(old[i]);
  if (word(from)) while (word(from - 1)) from--;
  if (word(to - 1)) while (word(to)) to++;
  const end = now.length - (old.length - to);
  return [old.slice(from, to).trim(), now.slice(from, Math.max(from, end)).trim()];
}
