// History in chapters (PF-13, docs/studio-folder.md): every 100 older versions packed into one compressed file in a
// script's `.studio/chapters/`, written once by one keeper. The single files stay a few days, then go (lib/pack.ts).

import type { Version } from './history';
import { patiently } from './files';
import { browserStore, nameKey } from './versioncache';
import { subpath } from './dirs';

// The versions in it by their single file's name (so they line up with `.studio/versions/`), and when it was packed.
export type Chapter = { v: 1; packed: string; versions: Record<string, Version> };
// What a reader needs to know of a chapter without opening it again: when it was packed and the names it holds.
export type Contents = { packed: string; names: string[] };

// <first single's name>_<last single's name>_<random>.json.gz, each name without .json: sorting the names sorts the
// chapters, and the range says which singles a chapter may hold without opening it.
const NAME = /^(\d{8}T\d{6}Z_[a-z0-9]+)_(\d{8}T\d{6}Z_[a-z0-9]+)_[a-z0-9]+\.json\.gz$/;

export const isChapter = (name: string) => NAME.test(name);
// The first and last single file names a chapter holds (with .json).
export function range(name: string): { first: string; last: string } {
  const [, first, last] = NAME.exec(name)!;
  return { first: `${first}.json`, last: `${last}.json` };
}

// The chapters there now, oldest first. A chapter still being written shows as name.crswap, so it isn't listed.
export async function listChapters(dir: FileSystemDirectoryHandle): Promise<string[]> {
  const folder = await chaptersFolder(dir, false);
  if (!folder) return [];
  const names: string[] = [];
  for await (const name of folder.keys()) if (isChapter(name)) names.push(name);
  return names.sort();
}

// What a chapter holds: this visit's memory, then this browser's, then the file itself (whose versions go to
// `found`, so the caller keeps them). Null while the file can't be read whole (still syncing): tried again next time.
export async function contents(
  dir: FileSystemDirectoryHandle,
  name: string,
  found: (versions: [string, Version][]) => void,
): Promise<Contents | null> {
  let known = memory.get(dir);
  if (!known) memory.set(dir, (known = new Map()));
  const had = known.get(name) ?? (await store.recall([nameKey(dir, name)])).get(nameKey(dir, name));
  if (had) {
    known.set(name, had);
    return had;
  }
  const chapter = await readChapter(dir, name);
  if (!chapter) return null;
  const entries = Object.entries(chapter.versions);
  found(entries);
  const got = { packed: chapter.packed, names: entries.map(([single]) => single).sort() };
  known.set(name, got);
  void store.keep([[nameKey(dir, name), got]]);
  return got;
}
const memory = new WeakMap<FileSystemDirectoryHandle, Map<string, Contents>>();
const store = browserStore<Contents>('script-studio-chapters', 1);

// The whole chapter, or null if it can't be read whole. Only versions whose id matches their name are kept.
export async function readChapter(dir: FileSystemDirectoryHandle, name: string): Promise<Chapter | null> {
  try {
    const folder = await chaptersFolder(dir, false);
    if (!folder) return null;
    // Read whole first (arrayBuffer, as every other file is read), then unpacked.
    const packed = new Blob([await (await (await folder.getFileHandle(name)).getFile()).arrayBuffer()]);
    const chapter: Chapter = JSON.parse(await new Response(packed.stream().pipeThrough(new DecompressionStream('gzip'))).text());
    if (chapter?.v !== 1 || typeof chapter.packed !== 'string' || !chapter.versions) return null;
    const versions = Object.entries(chapter.versions).filter(
      ([single, v]) => v?.v === 1 && typeof v.text === 'string' && single.endsWith(`_${v.id}.json`),
    );
    return { v: 1, packed: chapter.packed, versions: Object.fromEntries(versions) };
  } catch {
    return null; // Gone, half-synced, or cut short: read again next time.
  }
}

// Writes a new chapter of these versions (by their single file's name, oldest first); returns its name.
export async function writeChapter(dir: FileSystemDirectoryHandle, versions: [string, Version][], now = new Date()): Promise<string> {
  const names = versions.map(([single]) => single).sort();
  const name = `${names[0].replace(/\.json$/, '')}_${names.at(-1)!.replace(/\.json$/, '')}_${randomId()}.json.gz`;
  const chapter: Chapter = { v: 1, packed: now.toISOString(), versions: Object.fromEntries(versions) };
  const packed = await new Response(new Blob([JSON.stringify(chapter)]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
  const folder = (await chaptersFolder(dir, true))!;
  await patiently(async () => {
    const writable = await (await folder.getFileHandle(name, { create: true })).createWritable();
    try {
      await writable.write(packed);
      await writable.close();
    } catch (e) {
      await writable.abort().catch(() => {});
      throw e;
    }
  });
  return name;
}

async function chaptersFolder(dir: FileSystemDirectoryHandle, create: boolean): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await subpath(dir, ['.studio', 'chapters'], create);
  } catch {
    return null;
  }
}

function randomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => chars[b % 36]).join('');
}
