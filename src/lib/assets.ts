// The asset list (EX-6, mock-up 12): every file, link and "still to find" note across a script's rows, once each,
// with the rows that use it; and which files are missing from the script's folder.
import { assetFile } from './folder';
import { readFileRef, type FileRef, type Script } from './script';
import { subpath } from './dirs';

export type Asset = FileRef & { line: string; rows: number[] };
export type Row = { n: number; section: string; assets: Asset[] };

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
    const row: Row = { n: ++n, section, assets: [] };
    for (const line of block.files) {
      const ref = readFileRef(line.trim());
      const key = `${ref.kind}:${ref.kind === 'words' ? ref.label.toLowerCase() : ref.target}`;
      let asset = seen.get(key);
      if (!asset) seen.set(key, (asset = { ...ref, line, rows: [] }));
      if (!asset.rows.includes(n)) asset.rows.push(n);
      if (!row.assets.includes(asset)) row.assets.push(asset);
    }
    rows.push(row);
  }
  return rows;
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
