// The keeper packs History into chapters (PF-13, lib/chapters.ts): the oldest 100 single files not packed yet, once
// there are enough newer ones left over, and removes single files packed a few days ago.

import { chapterContents, singleNames, versionsNamed } from './history';
import { listChapters, range, writeChapter } from './chapters';
import { eachAtOnce } from './atonce';

const SIZE = 100; // versions in a chapter
const LEFT = 25; // single files always left unpacked: an open script and the list mostly need only the newest
const KEEP = 3 * 24 * 60 * 60 * 1000; // packed single files stay this long, for computers still syncing the chapter

// Tests shorten them ('chapter-size', 'chapter-keep' in this browser's storage, in versions and ms).
function knob(name: string, fallback: number): number {
  try {
    const set = localStorage.getItem(name);
    return set !== null && set !== '' && Number.isFinite(Number(set)) ? Number(set) : fallback;
  } catch {
    return fallback;
  }
}

// One step of tidying a script's History: removes the single files of one chapter packed long enough ago, or else
// packs one chapter. True if it did something (call again soon: there may be more).
export async function tidyHistory(dir: FileSystemDirectoryHandle, now = Date.now()): Promise<boolean> {
  const size = knob('chapter-size', SIZE);
  const singles = await singleNames(dir);
  const chapters = await listChapters(dir);
  for (const chapter of chapters) {
    const { first, last } = range(chapter);
    const inside = singles.filter((name) => name >= first && name <= last);
    if (!inside.length) continue;
    const got = await chapterContents(dir, chapter);
    if (!got || now - Date.parse(got.packed) < knob('chapter-keep', KEEP)) continue;
    // Only files the chapter really holds (it was read whole to know them).
    const held = new Set(got.names);
    const gone = inside.filter((name) => held.has(name));
    if (!gone.length) continue;
    await eachAtOnce(gone, (name) => removeSingle(dir, name));
    return true;
  }
  const after = chapters.length ? range(chapters.at(-1)!).last : '';
  const loose = singles.filter((name) => name > after);
  if (loose.length < size + LEFT) return false;
  const take = loose.slice(0, size);
  const versions = await versionsNamed(dir, take);
  if (versions.size < take.length) return false; // one still syncing: tried again later
  await writeChapter(dir, take.map((name) => [name, versions.get(name)!]));
  return true;
}

async function removeSingle(dir: FileSystemDirectoryHandle, name: string): Promise<void> {
  try {
    await (await (await dir.getDirectoryHandle('.studio')).getDirectoryHandle('versions')).removeEntry(name);
  } catch {
    // Gone already (another keeper), or busy: tried again at the next tidy.
  }
}
