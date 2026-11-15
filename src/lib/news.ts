// One "what's new" folder for the whole drive (PF-15, docs/studio-folder.md): whoever writes anything in a script
// (a save, script.md, a version, a comment, a take, a file, the plan) also drops a tiny written-once note in the
// picked folder's `.studio/news/`, named after the script. The 5 s check and the script list list that one folder
// and look inside a script only when it has a new note, with a slow full look every 2 minutes for edits made
// outside the app, which leave no note.
import { stamp, writeText } from './files';
import { subpath } from './dirs';

const KEEP = 60 * 60 * 1000; // notes older than this (by their name's time) are removed by whoever looks fully
/** A full look this often: what changed outside the app (Notepad, Explorer) left no note. Tests shorten it. */
export const FULL_EVERY = (() => {
  try {
    return Number(localStorage.getItem('full-every')) || 2 * 60 * 1000;
  } catch {
    return 2 * 60 * 1000;
  }
})();

// Script folders opened in this tab, with the picked folder they're in: only their writes leave a note.
const roots = new WeakMap<FileSystemDirectoryHandle, FileSystemDirectoryHandle>();
const mine = new Set<string>(); // notes this tab wrote, which its own Editor needn't look at

/** From now on, writes in `dir` (a script folder in `root`) leave a note. */
export function follow(root: FileSystemDirectoryHandle, dir: FileSystemDirectoryHandle) {
  roots.set(dir, root);
}

async function newsFolder(root: FileSystemDirectoryHandle, create: boolean): Promise<FileSystemDirectoryHandle> {
  return subpath(root, ['.studio', 'news'], create);
}

/** A note that `dir` changed: `<time>_<random>_<script folder>.json`. Never throws: a missed note is caught by the
 * next full look. */
export async function announce(dir: FileSystemDirectoryHandle, what: string): Promise<void> {
  const root = roots.get(dir);
  if (!root) return;
  try {
    const when = new Date();
    const name = `${stamp(when)}_${Math.random().toString(36).slice(2, 8).padEnd(6, '0')}_${dir.name}.json`;
    mine.add(name);
    await writeText(await newsFolder(root, true), name, JSON.stringify({ v: 1, script: dir.name, what, when: when.toISOString() }) + '\n');
  } catch {
    // Read-only folder or a busy drive: the full look finds the change.
  }
}

/** The script folder a note is about. */
export function scriptOf(name: string): string {
  return name.split('_').slice(2).join('_').replace(/\.json$/, '');
}

/** Watches the news folder for one reader (the Editor, or the list). */
export class News {
  #seen: Set<string> | null = null;
  #full = 0; // when the last full look started
  #folder: FileSystemDirectoryHandle | undefined; // kept for the visit, so a look is one listing
  constructor(private root: FileSystemDirectoryHandle) {}

  /** The scripts with notes not seen at the last look (yours too unless `skipMine`), or null when everything
   * should be looked at: the first look, a full look due, or the folder unreadable. A full look also removes
   * notes over an hour old. */
  async look(skipMine = false): Promise<Set<string> | null> {
    const full = !this.#seen || Date.now() - this.#full >= FULL_EVERY;
    let names: string[];
    try {
      names = await this.#names();
    } catch {
      this.#seen = null;
      this.#folder = undefined;
      return null;
    }
    const before = this.#seen;
    this.#seen = new Set(names);
    if (full) {
      this.#full = Date.now();
      await tidy(this.root, names);
      return null;
    }
    const fresh = new Set<string>();
    for (const name of names) if (!before!.has(name) && !(skipMine && mine.has(name))) fresh.add(scriptOf(name));
    return fresh;
  }

  // The notes' names, oldest first ([] while nobody has written one). Throws when the folder can't be read.
  async #names(): Promise<string[]> {
    try {
      this.#folder ??= await newsFolder(this.root, false);
    } catch (e) {
      if ((e as DOMException).name === 'NotFoundError') return [];
      throw e;
    }
    const names: string[] = [];
    // A note being written shows as "name.crswap" until it closes; its real name is there from the start.
    for await (const name of this.#folder.keys()) if (name.endsWith('.json')) names.push(name);
    return names.sort();
  }
}

// Notes over an hour old, by the time in their name, removed (two computers removing one at once is harmless).
async function tidy(root: FileSystemDirectoryHandle, names: string[]) {
  const old = stamp(new Date(Date.now() - KEEP));
  const gone = names.filter((n) => n < old);
  if (!gone.length) return;
  try {
    const folder = await newsFolder(root, false);
    for (const name of gone) {
      await folder.removeEntry(name).catch(() => {});
      mine.delete(name);
    }
  } catch {
    // Next full look.
  }
}
