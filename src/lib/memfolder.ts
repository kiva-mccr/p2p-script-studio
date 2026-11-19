// A folder of the app's own, kept in IndexedDB (the sealed app's example, SE-10): the part of the File System Access
// API the app uses (folders, files, writing, listing, removing), so every screen works on it as on a picked folder.
// Each file is one record keyed by its path; a folder is a record of its own.

type Rec = { blob: Blob; modified: number } | { dir: true };

const dom = (name: string, message: string) => new DOMException(message, name);

class Store {
  #db: Promise<IDBDatabase | null>;
  #queue: Promise<unknown> = Promise.resolve();
  constructor(name: string) {
    this.#db = new Promise((resolve) => {
      try {
        const open = indexedDB.open(name, 1);
        open.onupgradeneeded = () => open.result.createObjectStore('files');
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => resolve(null); // storage blocked: the folder lasts until the page closes
      } catch {
        resolve(null);
      }
    });
  }
  async all(): Promise<[string, Rec][]> {
    const db = await this.#db;
    if (!db) return [];
    return new Promise((resolve) => {
      const s = db.transaction('files').objectStore('files');
      const keys = s.getAllKeys();
      const values = s.getAll();
      values.onsuccess = () => resolve((keys.result as string[]).map((k, i) => [k, values.result[i] as Rec]));
      values.onerror = () => resolve([]);
    });
  }
  // Writes go in order, one after another.
  #do(work: (s: IDBObjectStore) => void): Promise<void> {
    const next = this.#queue.then(async () => {
      const db = await this.#db;
      if (!db) return;
      await new Promise<void>((resolve) => {
        const t = db.transaction('files', 'readwrite');
        work(t.objectStore('files'));
        t.oncomplete = t.onerror = t.onabort = () => resolve();
      });
    });
    this.#queue = next;
    return next;
  }
  put = (path: string, rec: Rec) => this.#do((s) => s.put(rec, path));
  remove = (path: string) => this.#do((s) => (s.delete(path), s.delete(IDBKeyRange.bound(`${path}/`, `${path}/￿`))));
}

abstract class Entry {
  constructor(readonly name: string, readonly path: string, readonly store: Store) {}
  async isSameEntry(other: unknown) { return other === this; }
  async queryPermission() { return 'granted' as PermissionState; }
  async requestPermission() { return 'granted' as PermissionState; }
}

type Chunk = string | Blob | BufferSource;
type Op = { type: 'write'; data: Chunk; position?: number } | { type: 'seek'; position: number } | { type: 'truncate'; size: number };

// Bytes from `at` on are `buf` padded with zeros up to `at` (a write or truncate past the end).
const padded = (buf: Blob, size: number) => (size <= buf.size ? buf.slice(0, size) : new Blob([buf, new Uint8Array(size - buf.size)]));

class MemFile extends Entry {
  readonly kind = 'file';
  data: Blob = new Blob();
  modified = Date.now();
  async getFile() { return new File([this.data], this.name, { lastModified: this.modified }); }
  async createWritable(options?: { keepExistingData?: boolean }) {
    let buf = options?.keepExistingData ? this.data : new Blob();
    let at = 0;
    let open = true;
    const file = this;
    // As in the browser, the file keeps its old bytes until close.
    return {
      async write(input: Chunk | Op) {
        if (!open) throw new TypeError('The file is closed');
        const op: Op = typeof input === 'object' && 'type' in input && !(input instanceof Blob) ? (input as Op) : { type: 'write', data: input as Chunk };
        if (op.type === 'seek') return void (at = op.position);
        if (op.type === 'truncate') return void ((buf = padded(buf, op.size)), (at = Math.min(at, op.size)));
        if (op.position !== undefined) at = op.position;
        const chunk = new Blob([op.data]);
        buf = new Blob([padded(buf, at), chunk, buf.slice(at + chunk.size)]);
        at += chunk.size;
      },
      async seek(position: number) { at = position; },
      async truncate(size: number) { await this.write({ type: 'truncate', size }); },
      async close() {
        if (!open) throw new TypeError('The file is closed');
        open = false;
        file.data = buf;
        file.modified = Date.now();
        await file.store.put(file.path, { blob: buf, modified: file.modified });
      },
      async abort() { open = false; },
    };
  }
}

class MemDir extends Entry {
  readonly kind = 'directory';
  readonly children = new Map<string, MemDir | MemFile>();

  #child<T extends MemDir | MemFile>(name: string, make: (() => T) | null, want: 'file' | 'directory'): T {
    if (!name || name === '.' || name === '..' || /[/\\]/.test(name)) throw new TypeError(`"${name}" isn't a valid name`);
    const found = this.children.get(name);
    if (found && found.kind !== want) throw dom('TypeMismatchError', `${name} is a ${found.kind}`);
    if (found) return found as T;
    if (!make) throw dom('NotFoundError', `${name} wasn't found`);
    const made = make();
    this.children.set(name, made);
    return made;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    return this.#child(name, options?.create ? () => {
      const f = new MemFile(name, this.#at(name), this.store);
      void this.store.put(f.path, { blob: f.data, modified: f.modified });
      return f;
    } : null, 'file');
  }
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    return this.#child(name, options?.create ? () => {
      const d = new MemDir(name, this.#at(name), this.store);
      void this.store.put(d.path, { dir: true });
      return d;
    } : null, 'directory');
  }
  async removeEntry(name: string, options?: { recursive?: boolean }) {
    const found = this.children.get(name);
    if (!found) throw dom('NotFoundError', `${name} wasn't found`);
    if (found instanceof MemDir && found.children.size && !options?.recursive) throw dom('InvalidModificationError', `${name} isn't empty`);
    this.children.delete(name);
    await this.store.remove(found.path);
  }
  async *entries(): AsyncGenerator<[string, MemDir | MemFile]> { for (const e of [...this.children]) yield e; }
  async *keys(): AsyncGenerator<string> { for (const k of [...this.children.keys()]) yield k; }
  async *values(): AsyncGenerator<MemDir | MemFile> { for (const v of [...this.children.values()]) yield v; }
  [Symbol.asyncIterator]() { return this.entries(); }

  #at(name: string) { return this.path ? `${this.path}/${name}` : name; }
}

/** The folder kept in the IndexedDB database `name`, as it was left. */
export async function memFolder(name: string): Promise<FileSystemDirectoryHandle> {
  const store = new Store(name);
  const root = new MemDir(name, '', store);
  // Sorted, so a folder's record comes before what's in it.
  for (const [path, rec] of (await store.all()).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const parts = path.split('/');
    let dir = root;
    for (const [i, part] of parts.entries()) {
      const found = dir.children.get(part);
      if (i === parts.length - 1 && !('dir' in rec)) {
        const f = new MemFile(part, path, store);
        f.data = rec.blob;
        f.modified = rec.modified;
        dir.children.set(part, f);
      } else if (found instanceof MemDir) dir = found;
      else {
        const d = new MemDir(part, parts.slice(0, i + 1).join('/'), store);
        dir.children.set(part, d);
        dir = d;
      }
    }
  }
  return root as unknown as FileSystemDirectoryHandle;
}
