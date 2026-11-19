// The asset list (EX-6, mock-up 12): every file, link and "still to find" note across a script's rows, once each,
// with the rows that use it; and which files are missing from the script's folder.
import { assetFile } from './folder';
import { readFileRef, type FileRef, type Script, type Row as ScriptRow } from './script';
import { clearMarks } from './format';
import { subpath } from './dirs';
import { bare, finders } from './finders';

// `who`: the people on a "to find" note (#211), from every row it is in.
export type Asset = FileRef & { line: string; rows: number[]; who: string[] };
export type Row = { n: number; section: string; assets: Asset[]; excerpt: string };

// The rows in order, each with its section's name and its assets. An asset used in two rows is the same object.
export function assetRows(script: Script): Row[] {
  const seen = new Map<string, Asset>();
  const rows: Row[] = [];
  let section = '';
  let n = 0;
  for (const block of script.blocks) {
    if (block.type === 'section') {
      section = block.title;
      continue;
    }
    const row: Row = { n: ++n, section, assets: [], excerpt: excerpt(block) };
    for (const line of block.files) {
      const ref = readFileRef(line.trim());
      const key = assetKey(ref);
      let asset = seen.get(key);
      if (!asset) seen.set(key, (asset = { ...ref, line, rows: [], who: [] }));
      if (ref.kind === 'words') for (const name of finders(line)) if (!asset.who.some((w) => w.toLowerCase() === name.toLowerCase())) asset.who.push(name);
      if (!asset.rows.includes(n)) asset.rows.push(n);
      if (!row.assets.includes(asset)) row.assets.push(asset);
    }
    rows.push(row);
  }
  return rows;
}

// Two lines are the same asset when their path or link is, or a note's words are (ignoring case and its people).
export const assetKey = (ref: FileRef): string => `${ref.kind}:${ref.kind === 'words' ? bare(ref.label).toLowerCase() : ref.target}`;

// How many "to find" notes each person is on (#211), by name trimmed and in lower case, for "For me".
export function findsBy(script: Script): Record<string, number> {
  const by: Record<string, number> = {};
  for (const asset of assetList(script)) for (const name of asset.who) by[name.trim().toLowerCase()] = (by[name.trim().toLowerCase()] ?? 0) + 1;
  return by;
}

// A row's words as one line for Assets (#212, board 82): its dialogue, or its On screen words when it has none, with
// the marks, list bullets and tick boxes taken out. Cut short by the page (CSS), not here.
export function excerpt(row: ScriptRow): string {
  const text = row.dialogue.trim() ? row.dialogue : row.onScreen;
  return clearMarks(text)
    .split('\n')
    .map((line) => line.replace(/^\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/, '').trim())
    .filter(Boolean)
    .join(' ');
}

// Every asset once, in the order they first appear.
export function assetList(script: Script): Asset[] {
  return [...new Set(assetRows(script).flatMap((row) => row.assets))];
}

// The paths in the Files column that aren't in the script's folder. Each folder they name is listed once (it was a
// look-up for every file); a name not in its folder's list is looked up as before, so a path whose letters differ in
// case from the file (fine on Windows) still counts as there.
export async function missingFiles(dir: FileSystemDirectoryHandle, assets: Asset[]): Promise<Set<string>> {
  const missing = new Set<string>();
  const listed = new Map<string, Promise<Set<string> | null>>();
  for (const asset of assets) {
    if (asset.kind !== 'path') continue;
    const parts = asset.target.split('/').filter((p) => p && p !== '.' && p !== '..');
    const where = parts.slice(0, -1).join('/');
    if (!listed.has(where)) listed.set(where, fileNames(dir, parts.slice(0, -1)));
    const names = await listed.get(where);
    if (names?.has(parts.at(-1)!)) continue;
    // No such folder: its files are missing without a look-up each (PF-17); the look-up already ignored case.
    if (!names || !(await assetFile(dir, asset.target))) missing.add(asset.target);
  }
  return missing;
}

// The names of the files in a folder inside the script's folder; null if it isn't there.
async function fileNames(dir: FileSystemDirectoryHandle, path: string[]): Promise<Set<string> | null> {
  try {
    const at = await subpath(dir, path);
    const names = new Set<string>();
    for await (const [name, handle] of at.entries()) if (handle.kind === 'file') names.add(name);
    return names;
  } catch {
    return null;
  }
}

// How many of a script's files are missing, for the script list. 0 when the script can't be read.
export async function countMissing(dir: FileSystemDirectoryHandle, script: Script): Promise<number> {
  return (await missingFiles(dir, assetList(script))).size;
}

// What a row still has to find or film (#227, board 86): its files missing from the folder (by name) and its "to find"
// notes, in the Files column's order. For the video's placeholder cards.
export function stillToFind(row: ScriptRow, missing: Set<string>): string[] {
  return row.files
    .map(readFileRef)
    .filter((f) => f.kind === 'words' || (f.kind === 'path' && missing.has(f.target)))
    .map((f) => f.label);
}
