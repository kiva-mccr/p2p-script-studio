// The sealed app's speech models (SE-5, SE-10): speech-models.zip, added once in Settings and kept by the browser
// (IndexedDB: Chrome gives a file opened from the computer no other storage), checked file by file against the
// SHA-256 pinned in models.lock.json. The zip stores its files as they are, so each one is a slice of it: nothing is
// unpacked or copied, and the speech workers read their slices (lib/sealedruntime.ts, lib/models.ts).
import lock from './models.lock.json';
import { MODELS_ZIP, type ModelsLock } from './modelfiles';

export type ModelsZipIndex = Record<string, [number, number]>; // "<model>/<path>": where its data starts, and its size
export type KeptModels = { blob: Blob; index: ModelsZipIndex };

const DB = 'script-studio-models';
const STORE = 'models';
const KEY = 'zip';

/** Where each stored file's data is in the zip, read from its central directory (the last bytes of the file). */
export async function zipIndex(zip: Blob): Promise<ModelsZipIndex> {
  const tailSize = Math.min(zip.size, 22 + 65535);
  const tail = new DataView(await zip.slice(zip.size - tailSize).arrayBuffer());
  let end = tailSize - 22;
  while (end >= 0 && tail.getUint32(end, true) !== 0x06054b50) end--;
  if (end < 0) throw new Error("it isn't a zip");
  const count = tail.getUint16(end + 10, true);
  const dirSize = tail.getUint32(end + 12, true);
  const dirAt = tail.getUint32(end + 16, true);
  const dir = new DataView(await zip.slice(dirAt, dirAt + dirSize).arrayBuffer());
  const index: ModelsZipIndex = {};
  for (let i = 0, at = 0; i < count; i++) {
    if (dir.getUint32(at, true) !== 0x02014b50) throw new Error("its list of files can't be read");
    const method = dir.getUint16(at + 10, true);
    const size = dir.getUint32(at + 20, true);
    const nameLength = dir.getUint16(at + 28, true);
    const local = dir.getUint32(at + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(dir.buffer, at + 46, nameLength));
    if (method !== 0) throw new Error(`${name} is compressed: use the zip as downloaded, not one made again`);
    const head = new DataView(await zip.slice(local, local + 30).arrayBuffer());
    index[name] = [local + 30 + head.getUint16(26, true) + head.getUint16(28, true), size];
    at += 46 + nameLength + dir.getUint16(at + 30, true) + dir.getUint16(at + 32, true);
  }
  return index;
}

async function sha256(blob: Blob): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** What's wrong with a zip for this version of the app: a pinned file missing or not the pinned one. None: it's right. */
export async function checkModels(zip: Blob, index: ModelsZipIndex, pinned: ModelsLock = lock as ModelsLock,
  onFile: (done: number, of: number) => void = () => {}): Promise<string[]> {
  const wanted = Object.entries(pinned).flatMap(([model, m]) => Object.entries(m.files).map(([path, f]) => ({ name: `${model}/${path}`, ...f })));
  const problems: string[] = [];
  for (const [i, f] of wanted.entries()) {
    const at = index[f.name];
    if (!at) problems.push(`${f.name} is missing`);
    else if (at[1] !== f.bytes || (await sha256(zip.slice(at[0], at[0] + at[1]))) !== f.sha256) problems.push(`${f.name} isn't the right file`);
    onFile(i + 1, wanted.length);
  }
  return problems;
}

function store<T>(mode: IDBTransactionMode, work: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const req = work(open.result.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => (resolve(req.result), open.result.close());
      req.onerror = () => (reject(req.error), open.result.close());
    };
  });
}

/** The zip added in Settings, if it is still the right one for this version (a new version pins new models). */
export async function keptModels(): Promise<KeptModels | null> {
  const kept = await store<(KeptModels & { lock?: string }) | undefined>('readonly', (s) => s.get(KEY)).catch(() => undefined);
  return kept && kept.lock === JSON.stringify(lock) ? { blob: kept.blob, index: kept.index } : null;
}

/** Whether a zip was added that a newer version no longer takes. */
export async function outdatedModels(): Promise<boolean> {
  const kept = await store<{ lock?: string } | undefined>('readonly', (s) => s.get(KEY)).catch(() => undefined);
  return !!kept && kept.lock !== JSON.stringify(lock);
}

export const keepModels = (m: KeptModels) => store('readwrite', (s) => s.put({ ...m, lock: JSON.stringify(lock) }, KEY));
export const forgetModels = () => store('readwrite', (s) => s.delete(KEY));

/** Checks a picked zip file by file and keeps it. What's wrong with it, for the page; '' when it was kept. */
export async function addModels(file: Blob, onFile: (done: number, of: number) => void = () => {}): Promise<string> {
  try {
    const index = await zipIndex(file);
    const wrong = await checkModels(file, index, undefined, onFile);
    if (wrong.length) throw new Error(`it isn't the zip for this version (${wrong[0]}${wrong.length > 1 ? `, and ${wrong.length - 1} more` : ''})`);
    await keepModels({ blob: file, index });
    return '';
  } catch (err) {
    return `That file can't be used: ${(err as Error).message}. Download ${MODELS_ZIP} again from the Download sealed page.`;
  }
}

// The offer on the first open (#327, board 92): shown once on this computer, kept beside the models.
const OFFERED = 'offered';

/** Whether to offer the models: never offered on this computer, and none kept (an older version's count as offered). */
export async function shouldOfferModels(): Promise<boolean> {
  const offered = await store<unknown>('readonly', (s) => s.get(OFFERED)).catch(() => true);
  return !offered && !(await store<unknown>('readonly', (s) => s.get(KEY)).catch(() => true));
}

export const markModelsOffered = () => store('readwrite', (s) => s.put(true, OFFERED)).catch(() => {});
