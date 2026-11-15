// A shared summary per script for the list (PF-12, docs/studio-folder.md): whoever's list reads a script the slow way
// leaves its title, status and counts in `.studio/summary/`, with a fingerprint of the files they came from. A
// computer new to the folder uses it while the script's files still match, instead of reading History and comments.

import { jsonNames, readJson, stamp, writeText } from './files';
import type { ForAll } from './forme';
import { sha256 } from './history';
import type { ScriptInfo } from './folder';

export type Summary = {
  v: 1;
  print: string; // sha256 of the fingerprint the counts were read under, your name left out
  head: Omit<ScriptInfo, 'path'>;
  counts: { missing: number; flagged: number; takeSeconds: number; words: number; dirs: string[] };
  forAll: ForAll;
  who: string;
  when: string;
};

const FOLDER = 'summary';
const OLD_AFTER = 2 * 60_000; // older summaries are removed by the next writer once they are this old

async function folder(dir: FileSystemDirectoryHandle, create: boolean): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await (await dir.getDirectoryHandle('.studio', { create })).getDirectoryHandle(FOLDER, { create });
  } catch {
    return null;
  }
}

export const sharedPrint = (base: string, dirs: string) => sha256(`${base}\n${dirs}`);

// The newest summary, or null when there's none or it can't be read yet (half-written, mid-sync).
export async function readSummary(dir: FileSystemDirectoryHandle): Promise<Summary | null> {
  const at = await folder(dir, false);
  if (!at) return null;
  try {
    const newest = (await jsonNames(at)).at(-1);
    const summary = newest ? await readJson<Summary>(at, newest) : null;
    return summary?.v === 1 && summary.forAll && summary.counts && summary.head ? summary : null;
  } catch {
    return null;
  }
}

// Writes a new summary (written once, never changed), then removes the older ones over 2 minutes old. False when
// it couldn't be written: the next computer reads the slow way.
export async function writeSummary(dir: FileSystemDirectoryHandle, summary: Omit<Summary, 'v' | 'when'>): Promise<boolean> {
  try {
    const at = await folder(dir, true);
    if (!at) return false;
    const now = new Date();
    const name = `${stamp(now)}_${Math.random().toString(36).slice(2, 8)}.json`;
    await writeText(at, name, JSON.stringify({ v: 1, ...summary, when: now.toISOString() }));
    const old = stamp(new Date(now.getTime() - OLD_AFTER));
    for (const other of await jsonNames(at)) {
      if (other < old) await at.removeEntry(other).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}
