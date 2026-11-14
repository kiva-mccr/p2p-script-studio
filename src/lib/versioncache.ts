// History files are written once and never changed (docs/studio-folder.md), so a file read once need not be read
// again (HI-3): kept in memory for this visit, and in this browser (IndexedDB) for the next ones.

import type { Version } from './history';

const DB = 'script-studio-history';
const STORE = 'versions';

// This visit's: per script folder, by file name. Repeated reads of the same script then only list the folder.
const memory = new WeakMap<FileSystemDirectoryHandle, Map<string, Version>>();

export function remembered(dir: FileSystemDirectoryHandle): Map<string, Version> {
  let known = memory.get(dir);
  if (!known) memory.set(dir, (known = new Map()));
  return known;
}

// The browser's key for a file: its script folder's name and its own. A file's name holds the second it was made and
// a random id, so the same name in the same script is the same file: kept versions are found without opening a file.
export const nameKey = (dir: FileSystemDirectoryHandle, name: string) => `${dir.name}/${name}`;

// Versions this browser kept from an earlier visit, by key. Storage refused (a private window): none.
export async function recallVersions(keys: string[]): Promise<Map<string, Version>> {
  const found = new Map<string, Version>();
  if (!keys.length) return found;
  try {
    // A hundred at a time, with a pause between, so a script opening with a big History still draws at once.
    for (let i = 0; i < keys.length; i += 100) {
      if (i) await new Promise((resolve) => setTimeout(resolve));
      const part = keys.slice(i, i + 100);
      const store = (await db()).transaction(STORE, 'readonly').objectStore(STORE);
      const got = await Promise.all(part.map((key) => request<Version | undefined>(store.get(key))));
      part.forEach((key, j) => got[j] && found.set(key, got[j]));
    }
  } catch {
    // Read from the files instead.
  }
  return found;
}

export async function keepVersions(entries: [string, Version][]): Promise<void> {
  if (!entries.length) return;
  try {
    const tx = (await db()).transaction(STORE, 'readwrite');
    for (const [key, version] of entries) tx.objectStore(STORE).put(version, key);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } catch {
    // Not kept: read from the files next visit.
  }
}

let opened: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('No IndexedDB'));
    // Version 2 keys by name (nameKey); version 1's keys held each file's size and time, so its entries are dropped.
    const open = indexedDB.open(DB, 2);
    open.onupgradeneeded = () => {
      if (open.result.objectStoreNames.contains(STORE)) open.result.deleteObjectStore(STORE);
      open.result.createObjectStore(STORE);
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
  opened.catch(() => (opened = null));
  return opened;
}

function request<T>(r: IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
  });
}
