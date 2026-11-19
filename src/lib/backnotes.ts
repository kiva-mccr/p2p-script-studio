// Notes for the writer from several reviewers (#248, board 84): `.studio/notes/`, one file per note, change or tick
// (docs/studio-folder.md). The newest file about a note counts.

import { announce } from './news';
import { eachAtOnce } from './atonce';
import { subpath } from './dirs';

// `by` wrote the note; `who` wrote this file (a tick in Write is the writer's). `made`: when the note was first added.
export type BackNote = { v: 1; id: string; by: string; who: string; when: string; made: string; text: string; removed?: true };
// A note as a send back carries it in its History entry (`notes`).
export type SentNote = { id: string; by: string; made: string; text: string };

// Every note, newest file each. A file still being written is skipped; the next read finds it.
export async function readBackNotes(dir: FileSystemDirectoryHandle): Promise<Map<string, BackNote>> {
  const folder = await notesFolder(dir, false);
  const notes = new Map<string, BackNote>();
  if (!folder) return notes;
  const names: string[] = [];
  for await (const name of folder.keys()) if (name.endsWith('.json')) names.push(name);
  names.sort();
  const read = await eachAtOnce(names, async (name) => {
    try {
      const note = JSON.parse(await (await (await folder.getFileHandle(name)).getFile()).text());
      return note.v === 1 && note.id && typeof note.text === 'string' ? (note as BackNote) : null;
    } catch {
      return null;
    }
  });
  for (const note of read) if (note) notes.set(note.id, note); // names sort by time: the last one counts
  return notes;
}

// A new file about a note: added, changed, ticked or deleted (`removed`).
export async function writeBackNote(dir: FileSystemDirectoryHandle, note: Omit<BackNote, 'v' | 'when'>, now = new Date()): Promise<BackNote> {
  const when = now.toISOString();
  const file: BackNote = { v: 1, ...note, when };
  const folder = (await notesFolder(dir, true))!;
  const name = `${when.replace(/[-:.]/g, '')}_${note.id}_${randomId()}.json`;
  const writable = await (await folder.getFileHandle(name, { create: true })).createWritable();
  await writable.write(JSON.stringify(file, null, 2) + '\n');
  await writable.close();
  await announce(dir, 'note');
  return file;
}

// Notes added since the round began (`since`, the newest "Sent for review"; '' for any time), not deleted, oldest first.
export function waiting(notes: Map<string, BackNote>, since: string): BackNote[] {
  const from = since ? Date.parse(since) : 0;
  return [...notes.values()].filter((n) => !n.removed && Date.parse(n.made) >= from).sort((a, b) => a.made.localeCompare(b.made));
}

export function newId(): string {
  return randomId();
}

async function notesFolder(dir: FileSystemDirectoryHandle, create: boolean): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await subpath(dir, ['.studio', 'notes'], create);
  } catch {
    return null;
  }
}

function randomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => chars[b % 36]).join('');
}
