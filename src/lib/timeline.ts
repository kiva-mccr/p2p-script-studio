// The storyboard timeline (SB-1, mock-up 63): a row's `Timeline:` line read and written, and the script laid out as
// blocks in time. The line holds only what differs from the default: a sequence of every image in the row's Files,
// sharing the row's time equally, with nothing after it.

import { clearMarks } from './format';
import { frontValue, rows, readFileRef, setFrontValue, timelineOnly, type Row, type Script } from './script';

// The video's shape (SB-3), kept with the script in its front matter: `shape: upright` (9:16), else wide (16:9).
export type Shape = 'wide' | 'upright';
export const shapeOf = (front: string | null): Shape => (frontValue(front, 'shape') === 'upright' ? 'upright' : 'wide');
// Wide is the default, so it is written as no line at all.
// A front matter left empty is none at all (null).
export function withShape(front: string | null, shape: Shape): string | null {
  if (shape === 'upright') return setFrontValue(front, 'shape', 'upright');
  return (front ?? '').split('\n').filter((l) => !l.startsWith('shape:')).join('\n') || null;
}

export type After = { kind: 'hold'; seconds: number } | { kind: 'placeholder'; seconds: number; label: string };
export type Choices = {
  collage: boolean; // all the pictures at once, side by side (else one after another)
  without: string[]; // image paths left out
  cuts: string[]; // words in the dialogue where the next picture starts, in order
  after: After | null; // a hold or placeholder after the row
  rest: string[]; // parts the app doesn't understand, kept as typed
};

const SECONDS = '(\\d+(?:\\.\\d+)?) ?s';
const HOLD = new RegExp(`^then hold ${SECONDS}$`, 'i');
const PLACEHOLDER = new RegExp(`^then placeholder ${SECONDS}(?: "([^"]*)")?$`, 'i');

export function readChoices(line: string): Choices {
  const choices: Choices = { collage: false, without: [], cuts: [], after: null, rest: [] };
  for (const part of split(line)) {
    let m: RegExpMatchArray | null;
    if (/^(sequence|collage)$/i.test(part)) choices.collage = part.toLowerCase() === 'collage';
    else if ((m = part.match(/^without (.+)$/i))) choices.without.push(m[1].trim());
    else if ((m = part.match(/^cuts? at ((?:"[^"]+"\s*)+)$/i))) choices.cuts.push(...[...m[1].matchAll(/"([^"]+)"/g)].map((w) => w[1]));
    else if ((m = part.match(HOLD))) choices.after = { kind: 'hold', seconds: Number(m[1]) };
    else if ((m = part.match(PLACEHOLDER))) choices.after = { kind: 'placeholder', seconds: Number(m[1]), label: m[2] ?? '' };
    else choices.rest.push(part);
  }
  return choices;
}

export function writeChoices(c: Choices): string {
  const parts: string[] = [];
  if (c.collage) parts.push('collage');
  for (const path of c.without) parts.push(`without ${path}`);
  if (c.cuts.length) parts.push(`cuts at ${c.cuts.map((w) => `"${unquote(w)}"`).join(' ')}`);
  parts.push(...c.rest);
  if (c.after?.kind === 'hold') parts.push(`then hold ${round(c.after.seconds)} s`);
  if (c.after?.kind === 'placeholder') {
    const label = unquote(c.after.label).trim();
    parts.push(`then placeholder ${round(c.after.seconds)} s${label ? ` "${label}"` : ''}`);
  }
  return parts.join(', ');
}

// A row's line with one choice changed.
export function changeChoices(row: Row, change: (c: Choices) => void): string {
  const c = readChoices(row.timeline);
  change(c);
  return writeChoices(c);
}

const IMAGE = /\.(jpe?g|png|gif|webp|svg|avif|bmp)$/i;
const VIDEO = /\.(mp4|webm|mov|m4v)$/i;
export const isVideo = (path: string) => VIDEO.test(path);

// The pictures a row can show: its Files paths that are images or videos, in order.
export function pictureFiles(row: Row): { path: string; timelineOnly: boolean; video: boolean }[] {
  return row.files
    .map((line) => ({ ref: readFileRef(line), only: timelineOnly(line) }))
    .filter(({ ref }) => ref.kind === 'path' && (IMAGE.test(ref.target) || VIDEO.test(ref.target)))
    .map(({ ref, only }) => ({ path: ref.target, timelineOnly: only, video: VIDEO.test(ref.target) }));
}

// The pictures a row shows on the timeline: its pictures less the ones left out.
export function picks(row: Row): string[] {
  const without = new Set(readChoices(row.timeline).without);
  return pictureFiles(row).map((p) => p.path).filter((p) => !without.has(p));
}

export type Shot = { path: string; start: number; seconds: number }; // one picture's turn in a sequence, in seconds from the row's start
export type TimeBlock =
  | { kind: 'row'; id: string; start: number; seconds: number; take: boolean; collage: boolean; shots: Shot[]; picks: string[] }
  | { kind: 'hold' | 'placeholder'; id: string; start: number; seconds: number; label: string; after: string };
export type Lane = { title: string; start: number; seconds: number; first: string }; // a section's span, and its first row

// When each word of a row is said (seconds from the row's start), to place cuts on a word.
export type Words = { word: string; start: number }[];

// Word timings estimated from the dialogue: each word starts as far into the row as it is into the line, by letters
// (a long word takes longer to say). For a row with no take, or one not heard yet (SB-8, `heardWords`).
export function estimateWords(dialogue: string, seconds: number): Words {
  const words = [...plainText(dialogue).matchAll(/\S+/g)];
  const letters = (w: string) => Math.max(1, plain(w).length);
  const all = words.reduce((n, w) => n + letters(w[0]), 0);
  let before = 0;
  return words.map((w) => {
    const start = all ? (before / all) * seconds : 0;
    before += letters(w[0]);
    return { word: w[0], start };
  });
}

// Word timings heard in the take (SB-8): `heard` is what the speech model heard, each word with when it starts
// (seconds from the recording's start); `from` is where the row's take starts playing (the crop) and `seconds` how
// long it plays. Each dialogue word the model heard takes its time; the words between (misheard, or numbers said
// as words) share the time between them by letters, as `estimateWords`. Null when none of the words were heard.
export function heardWords(dialogue: string, heard: [string, number][], from: number, seconds: number): Words | null {
  const said = [...plainText(dialogue).matchAll(/\S+/g)].map((w) => w[0]);
  const a = said.map(plain);
  const b = heard.map((h) => plain(h[0]));
  const n = a.length, m = b.length;
  if (!n || !m) return null;
  // The longest run of the same words in the same order (both lists are short: a row's line).
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] && a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const at: (number | null)[] = Array(n).fill(null);
  let last = 0;
  for (let i = 0, j = 0; i < n && j < m; ) {
    if (a[i] && a[i] === b[j]) {
      last = Math.min(seconds, Math.max(last, heard[j][1] - from)); // never before an earlier word, nor past the end
      at[i++] = last;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) i++;
    else j++;
  }
  if (at.every((t) => t === null)) return null;
  const letters = said.map((w) => Math.max(1, plain(w).length));
  const before = [0];
  for (const l of letters) before.push(before[before.length - 1] + l);
  // Between two heard words (or the start, 0, and the end, `seconds`), by letters.
  let prev = -1;
  for (let i = 0; i <= n; i++) {
    if (i < n && at[i] === null) continue;
    const t0 = prev < 0 ? 0 : at[prev]!, l0 = prev < 0 ? 0 : before[prev];
    const t1 = i < n ? at[i]! : seconds, l1 = before[i];
    for (let k = prev + 1; k < i; k++) at[k] = l1 > l0 ? t0 + ((t1 - t0) * (before[k] - l0)) / (l1 - l0) : t0;
    prev = i;
  }
  return said.map((word, i) => ({ word, start: at[i]! }));
}

// The dialogue's words as said, marks taken out (bold, links, equations' dollars).
export function dialogueWords(dialogue: string): string[] {
  return plainText(dialogue).split(/\s+/).filter(Boolean);
}

// The whole script in time: rows (take length, or read time without one; a row with neither is left out) and the
// holds and placeholders after them. Matches Play the script (lib/play.svelte.ts plan).
export function layout(
  script: Script,
  length: (row: Row) => { seconds: number; take: boolean; words?: Words | null },
  words: (row: Row, seconds: number) => Words | null = (row, seconds) => estimateWords(row.dialogue, seconds),
): { blocks: TimeBlock[]; lanes: Lane[]; total: number } {
  const blocks: TimeBlock[] = [];
  const lanes: Lane[] = [];
  let t = 0;
  let lane: Lane | null = null;
  for (const block of script.blocks) {
    if (block.type === 'section') {
      lane = { title: block.title, start: t, seconds: 0, first: '' };
      lanes.push(lane);
      continue;
    }
    const { seconds, take, words: heard } = length(block);
    const c = readChoices(block.timeline);
    if (seconds > 0) {
      const shown = picks(block);
      blocks.push({ kind: 'row', id: block.id, start: t, seconds, take, collage: c.collage && shown.length > 1, shots: shots(shown, seconds, c, heard ?? words(block, seconds)), picks: shown });
      if (lane && !lane.first) lane.first = block.id;
      t += seconds;
    }
    if (c.after && c.after.seconds > 0) {
      const label = c.after.kind === 'placeholder' ? c.after.label : '';
      blocks.push({ kind: c.after.kind, id: `${c.after.kind}:${block.id}`, start: t, seconds: c.after.seconds, label, after: block.id });
      t += c.after.seconds;
    }
    if (lane) lane.seconds = t - lane.start;
  }
  return { blocks, lanes: lanes.filter((l) => l.seconds > 0), total: t };
}

// Each picture's turn in a sequence: from a cut word to the next, or equal shares without cuts (or without word
// timings). A collage or a single picture is one turn for the whole row.
export function shots(paths: string[], seconds: number, c: Choices, words: Words | null): Shot[] {
  if (!paths.length) return [];
  if (c.collage || paths.length === 1) return paths.map((path) => ({ path, start: 0, seconds }));
  const starts = [0];
  const times = words && c.cuts.length ? cutTimes(c.cuts, words) : [];
  for (let i = 1; i < paths.length; i++) {
    const at = times[i - 1];
    starts.push(at !== undefined && at > starts[i - 1] && at < seconds ? at : NaN);
  }
  // Pictures with no cut share the time between the cuts around them equally.
  for (let i = 1; i < starts.length; i++) {
    if (!Number.isNaN(starts[i])) continue;
    let j = i;
    while (j < starts.length && Number.isNaN(starts[j])) j++;
    const from = starts[i - 1];
    const to = j < starts.length ? starts[j] : seconds;
    for (let k = i; k < j; k++) starts[k] = from + ((to - from) * (k - i + 1)) / (j - i + 1);
  }
  return paths.map((path, i) => ({ path, start: starts[i], seconds: (i + 1 < starts.length ? starts[i + 1] : seconds) - starts[i] }));
}

// When each cut word is said: the first time it is heard after the previous cut.
export function cutTimes(cuts: string[], words: Words): number[] {
  return cutPositions(words.map((w) => w.word), cuts).map((i) => words[i].start);
}

// The cut words of a row as positions in its dialogue's words (the n-th word, from 0), so the dialogue can show
// them: each cut is the first match after the previous one. A cut can be a few words ("the leaf"): the first is
// where it falls, the rest tell a repeated word apart (`cutWords`).
export function cutPositions(dialogueWords: string[], cuts: string[]): number[] {
  const said = dialogueWords.map(plain);
  const at: number[] = [];
  let from = 0;
  for (const cut of cuts) {
    const want = cut.split(/\s+/).map(plain).filter(Boolean);
    const i = want.length ? findFrom(said, want, from) : -1;
    if (i < 0) break;
    at.push(i);
    from = i + 1;
  }
  return at;
}

// The cuts to save for these positions: each its word, with as many words after it as it takes for the first match
// after the previous cut to be this one (so a second "the" is saved as "the leaf", not found as the first "the").
export function cutWords(dialogueWords: string[], positions: number[]): string[] {
  const said = dialogueWords.map(plain);
  const out: string[] = [];
  let from = 0;
  for (const at of positions) {
    const i = said.findIndex((w, j) => j >= at && w); // a "word" of only marks ("—") cuts on the next word
    if (i < 0) break;
    const phrase: number[] = [];
    for (let j = i; j < said.length; j++) {
      if (!said[j]) continue;
      phrase.push(j);
      if (findFrom(said, phrase.map((k) => said[k]), from) === i) break;
    }
    out.push(phrase.map((k) => dialogueWords[k].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).join(' '));
    from = i + 1;
  }
  return out;
}

// The first place from `from` on where the words `want` are said one after another (words of only marks skipped).
function findFrom(said: string[], want: string[], from: number): number {
  for (let i = from; i < said.length; i++) {
    if (said[i] !== want[0]) continue;
    let j = i + 1;
    let k = 1;
    for (; k < want.length; j++) {
      if (j >= said.length) break;
      if (!said[j]) continue;
      if (said[j] !== want[k]) break;
      k++;
    }
    if (k === want.length) return i;
  }
  return -1;
}

const plainText = (text: string) => clearMarks(text);
export const plain = (word: string): string => word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

export function rowById(script: Script, id: string): Row | undefined {
  return rows(script).find((r) => r.id === id);
}

// Commas split parts, except inside quotes.
function split(line: string): string[] {
  const parts: string[] = [];
  let part = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    if (ch === ',' && !quoted) {
      parts.push(part.trim());
      part = '';
    } else part += ch;
  }
  parts.push(part.trim());
  return parts.filter(Boolean);
}

const unquote = (text: string) => text.replace(/"/g, '”');
const round = (n: number) => String(Math.round(n * 10) / 10);

// Issue #243: the zoom a timeline opens at. The most of it on screen (the smallest zoom, doubling from 1) that still
// gives a typical row (the median) `readable` pixels for its words and pictures; a few short rows don't zoom it all in.
export const ZOOM_MAX = 64;
export function fitZoom(seconds: number[], total: number, width: number, readable = 120): number {
  if (!seconds.length || !total || width <= 0) return 1;
  const sorted = [...seconds].sort((a, b) => a - b);
  const median = sorted[Math.floor((sorted.length - 1) / 2)];
  let zoom = 1;
  while (zoom < ZOOM_MAX && (median / total) * width * zoom < readable) zoom *= 2;
  return zoom;
}
