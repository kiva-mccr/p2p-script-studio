// Comments in History (RV-6, board 48): each comment or suggestion is placed once, on the version that changed the
// cell it is about (the first one made after it), so a change shows why it was made. One that nothing has changed
// for yet stays on the version that was current when it was made.

import { fieldText, type Field, type Thread } from './comments';
import type { Version } from './history';
import { parseScript, rows } from './script';

// A version's comments: `changed` under the cell they led to (key `row:field`), `open` the rest.
export type Placed = { changed: Map<string, Thread[]>; open: Thread[] };

const FIELDS: Field[] = ['dialogue', 'on_screen', 'files'];
export const cellKey = (row: string, field: Field) => `${row}:${field}`;

// versions oldest first; list as threads() gives them (deleted ones already left out). Keyed by version id.
// `from` (PF-4): History shows only the versions from this index on, so only they get comments; older versions are
// looked at only to see whether an older comment's cell changed before them.
export function placeComments(versions: Version[], list: Thread[], from = 0): Map<string, Placed> {
  from = Math.min(Math.max(from, 0), versions.length);
  const placed = new Map<string, Placed>(versions.slice(from).map((v) => [v.id, { changed: new Map(), open: [] }]));
  if (from >= versions.length) return placed;
  const byId = new Map(versions.map((v) => [v.id, v]));
  const touched: Set<string>[] = [];
  const touchedAt = (i: number) => (touched[i] ??= changedCells(versions[i], byId.get(versions[i].parents[0] ?? '') ?? versions[i - 1]));
  const times = versions.map((v) => Date.parse(v.when));
  for (const t of [...list].reverse()) {
    const at = Date.parse(t.comment.when);
    const key = t.comment.row ? cellKey(t.comment.row, t.comment.field ?? 'dialogue') : '';
    const current = Math.max(times.findLastIndex((time) => time <= at), 0);
    let i = -1;
    if (key) for (let j = current + 1; j < versions.length && i < 0; j++) if (times[j] > at && touchedAt(j).has(key)) i = j;
    if (i >= from) {
      const changed = placed.get(versions[i].id)!.changed;
      changed.set(key, [...(changed.get(key) ?? []), t]);
    } else if (i < 0 && current >= from) {
      placed.get(versions[current].id)!.open.push(t);
    }
  }
  return placed;
}

// The cells a version changed, compared with the one it was made from. Kept for this visit by both ids, checked
// against both texts (test scripts reuse ids). Rows are compared as text first and parsed only when they differ: parsing all 2,000
// versions whole froze History for over a second (PF-4).
const changedMemo = new Map<string, { was: string; now: string; keys: Set<string> }>();
let bodiesMemo: { text: string; bodies: Map<string, string> } | null = null;
function changedCells(v: Version, before: Version | undefined): Set<string> {
  if (!before) return new Set();
  const memoKey = `${before.id}>${v.id}`;
  const kept = changedMemo.get(memoKey);
  if (kept && kept.was === before.text && kept.now === v.text) return kept.keys;
  const keys = new Set<string>();
  const was = rowBodies(before.text), now = rowBodies(v.text);
  for (const id of new Set([...was.keys(), ...now.keys()])) {
    const a = was.get(id), b = now.get(id);
    if (a === b) continue;
    const ra = a === undefined ? undefined : oneRow(id, a), rb = b === undefined ? undefined : oneRow(id, b);
    for (const field of FIELDS) if (!ra || !rb || fieldText(ra, field) !== fieldText(rb, field)) keys.add(cellKey(id, field));
  }
  changedMemo.set(memoKey, { was: before.text, now: v.text, keys });
  return keys;
}

// Each row's lines after its heading, by id (the last of two with one id, as a parse would keep). Kept for the last
// text asked for, as each version is compared with the next.
const HEADING = /^##? (?!#).*$/gm;
const ID = /<!--\s*id:\s*([a-z0-9]+)\s*-->/;
function rowBodies(source: string): Map<string, string> {
  if (bodiesMemo?.text === source) return bodiesMemo.bodies;
  const text = source.includes('\r') ? source.replace(/\r\n?/g, '\n') : source;
  const bodies = new Map<string, string>();
  let id: string | null = null, at = 0;
  for (const h of text.matchAll(HEADING)) {
    if (id !== null) bodies.set(id, text.slice(at, h.index));
    id = h[0][1] === '#' ? (h[0].match(ID)?.[1] ?? '') : null;
    at = h.index! + h[0].length;
  }
  if (id !== null) bodies.set(id, text.slice(at));
  bodiesMemo = { text: source, bodies };
  return bodies;
}
const oneRow = (id: string, body: string) => rows(parseScript(`## <!-- id: ${id} -->${body}`))[0];

// What History shows for a thread's state, and who, kept apart so Feedback's Cover hides only the name.
export function stateParts(t: Thread): { what: string; by?: string } {
  if (t.decision) return { what: t.decision === 'accepted' ? 'Accepted' : 'Rejected', by: t.by };
  if (t.held) return { what: 'On hold', by: t.held.who };
  return t.resolved ? { what: 'Resolved', by: t.by } : { what: 'Open' };
}
