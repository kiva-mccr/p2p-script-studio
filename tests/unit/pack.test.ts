import { describe, expect, it } from 'vitest';
import { listVersions, recentVersions, sinceSend } from '../../src/lib/history';
import { tidyHistory } from '../../src/lib/pack';
import { listChapters, readChapter } from '../../src/lib/chapters';

// A script folder in memory, folders and files, shared by every "computer" made from it (each gets its own handles,
// so nothing this visit remembered carries over). Counts how often each file is opened.
type Tree = Map<string, Tree | Blob>;
function computer(root: Tree, opened: Record<string, number> = {}) {
  const folder = (tree: Tree, name: string): FileSystemDirectoryHandle =>
    ({
      name,
      kind: 'directory',
      async *keys() {
        yield* [...tree.keys()];
      },
      async getDirectoryHandle(child: string, { create = false } = {}) {
        let sub = tree.get(child);
        if (!sub && create) tree.set(child, (sub = new Map()));
        if (!(sub instanceof Map)) throw new DOMException('Gone', 'NotFoundError');
        return folder(sub, child);
      },
      async getFileHandle(child: string, { create = false } = {}) {
        if (!tree.has(child) && create) tree.set(child, new Blob([]));
        if (!(tree.get(child) instanceof Blob)) throw new DOMException('Gone', 'NotFoundError');
        return {
          name: child,
          getFile: async () => ((opened[child] = (opened[child] ?? 0) + 1), tree.get(child) as Blob),
          createWritable: async () => {
            const parts: BlobPart[] = [];
            return { write: async (part: BlobPart) => void parts.push(part), close: async () => void tree.set(child, new Blob(parts)), abort: async () => {} };
          },
        };
      },
      async removeEntry(child: string) {
        if (!tree.delete(child)) throw new DOMException('Gone', 'NotFoundError');
      },
    }) as unknown as FileSystemDirectoryHandle;
  return folder(root, 'Episode 1');
}

const stamp = (i: number) => `202611${String(10 + Math.floor(i / 24)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}0000Z`;
const iso = (i: number) => stamp(i).replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
const id = (i: number) => `v${String(i).padStart(7, '0')}`;
const single = (i: number) => `${stamp(i)}_${id(i)}.json`;
const send = { kind: 'review', note: 'Sent for review', who: 'Kiva' };
function history(n: number, special: Record<number, object> = {}): Tree {
  const versions: Tree = new Map();
  for (let i = 0; i < n; i++) {
    const entry = { v: 1, id: id(i), parents: i ? [id(i - 1)] : [], who: 'Ana', when: iso(i), kind: 'edit', note: '', sha256: '', text: `text ${i}`, ...special[i] };
    versions.set(single(i), new Blob([JSON.stringify(entry)]));
  }
  return new Map([['.studio', new Map([['versions', versions]])]]);
}
const singles = (root: Tree) => [...((root.get('.studio') as Tree).get('versions') as Tree).keys()];
const DAY = 24 * 60 * 60 * 1000;
const ids = (n: number, from = 0) => Array.from({ length: n - from }, (_, i) => id(from + i));

describe('History in chapters (PF-13)', () => {
  it('packs the oldest 100 once 125 are loose, and keeps the single files for now', async () => {
    const root = history(150);
    const dir = computer(root);
    expect(await tidyHistory(dir)).toBe(true);
    const [chapter] = await listChapters(dir);
    expect(chapter).toMatch(new RegExp(`^${stamp(0)}_${id(0)}_${stamp(99)}_${id(99)}_[a-z0-9]{6}\\.json\\.gz$`));
    expect(Object.keys((await readChapter(dir, chapter))!.versions)).toHaveLength(100);
    expect(singles(root)).toHaveLength(150);
    expect(await tidyHistory(dir)).toBe(false); // 50 loose, and the single files are kept 3 days
    expect((await listVersions(computer(root))).map((v) => v.id)).toEqual(ids(150));
  });

  it('removes the packed single files after 3 days; a new computer reads the chapter whole, once', async () => {
    const root = history(150);
    await tidyHistory(computer(root));
    expect(await tidyHistory(computer(root), Date.now() + 4 * DAY)).toBe(true);
    expect(singles(root)).toEqual(Array.from({ length: 50 }, (_, i) => single(100 + i)));
    const opened: Record<string, number> = {};
    const dir = computer(root, opened);
    expect((await listVersions(dir)).map((v) => v.id)).toEqual(ids(150));
    expect((await listVersions(dir)).map((v) => v.id)).toEqual(ids(150));
    const chapters = Object.keys(opened).filter((name) => name.endsWith('.gz'));
    expect(chapters.map((name) => opened[name])).toEqual([1]);
  });

  it('removes only the single files the chapter holds', async () => {
    const root = history(150);
    await tidyHistory(computer(root));
    // Synced in late from another computer: in the chapter's range by name, but not in it.
    const late = `${stamp(50)}_zzzzzzzz.json`;
    ((root.get('.studio') as Tree).get('versions') as Tree).set(late, new Blob([JSON.stringify({ v: 1, id: 'zzzzzzzz', parents: [], who: 'Jo', when: iso(50), kind: 'edit', note: '', sha256: '', text: 'late' })]));
    await tidyHistory(computer(root), Date.now() + 4 * DAY);
    expect(singles(root)).toContain(late);
    expect(await listVersions(computer(root))).toHaveLength(151);
  });

  it('packs one chapter a step until 25 to 124 are left loose', async () => {
    const root = history(460);
    const later = Date.now() + 4 * DAY;
    let steps = 0;
    while (await tidyHistory(computer(root), later)) steps++;
    expect((await listChapters(computer(root))).length).toBe(4);
    expect(singles(root)).toHaveLength(60);
    expect(steps).toBe(8); // each chapter packed, then its single files removed
  });

  it('ignores a chapter that is half written, and two chapters of the same versions count once', async () => {
    const root = history(150);
    await tidyHistory(computer(root));
    await tidyHistory(computer(root)); // nothing: a second keeper at the same moment would have written the same
    const chapters = (root.get('.studio') as Tree).get('chapters') as Tree;
    const [name, blob] = [...chapters][0] as [string, Blob];
    chapters.set(name.replace(/_[a-z0-9]{6}\.json\.gz$/, '_twin00.json.gz'), blob);
    chapters.set(`${stamp(0)}_${id(0)}_${stamp(9)}_${id(9)}_broken.json.gz`, new Blob([blob.slice(0, 40)]));
    expect((await listVersions(computer(root))).map((v) => v.id)).toEqual(ids(150));
  });

  it('reads back into the chapters for the newest send, the same as from single files', async () => {
    const root = history(310, { 40: send, 150: send, 260: { kind: 'review', note: 'Sent back to writer', who: 'Ana' } });
    const before = (await sinceSend(computer(root))).map((v) => v.id);
    const recentBefore = (await recentVersions(computer(root))).map((v) => v.id);
    const later = Date.now() + 4 * DAY;
    while (await tidyHistory(computer(root), later));
    expect(singles(root).length).toBeLessThan(125);
    expect((await sinceSend(computer(root))).map((v) => v.id)).toEqual(before);
    expect((await recentVersions(computer(root))).map((v) => v.id)).toEqual(recentBefore);
    expect(before[0]).toBe(id(150));
  });
});
