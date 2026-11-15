import { describe, expect, it } from 'vitest';
import { missingFiles } from '../../src/lib/assets';
import { listNotes } from '../../src/lib/comments';
import { readTakes } from '../../src/lib/voice.svelte';

// The 5 s check reads only what is new (PF-1). A folder in memory: nested objects are folders, strings are files
// (with a date in `dates`); `reads` counts how often each file was opened, `looks` each look-up of a name.
type Tree = { [name: string]: Tree | string };
function folder(tree: Tree, dates: Record<string, number> = {}) {
  const reads: Record<string, number> = {};
  let looks = 0;
  const make = (node: Tree, path: string): FileSystemDirectoryHandle =>
    ({
      kind: 'directory',
      async getDirectoryHandle(name: string) {
        looks++;
        if (typeof node[name] !== 'object') throw new DOMException('Gone', 'NotFoundError');
        return make(node[name] as Tree, `${path}${name}/`);
      },
      async getFileHandle(name: string) {
        looks++;
        if (typeof node[name] !== 'string') throw new DOMException('Gone', 'NotFoundError');
        return file(node, name, `${path}${name}`);
      },
      async *keys() {
        yield* Object.keys(node);
      },
      async *entries() {
        for (const name of Object.keys(node)) {
          yield [name, typeof node[name] === 'string' ? file(node, name, `${path}${name}`) : make(node[name] as Tree, `${path}${name}/`)];
        }
      },
    }) as unknown as FileSystemDirectoryHandle;
  const file = (node: Tree, name: string, path: string) => ({
    kind: 'file',
    async getFile() {
      const text = node[name] as string;
      return { size: text.length, lastModified: dates[path] ?? 1, text: async () => ((reads[path] = (reads[path] ?? 0) + 1), text) };
    },
  });
  return { dir: make(tree, ''), reads, looks: () => looks };
}

const note = (id: string) => JSON.stringify({ v: 1, id, kind: 'comment', who: 'Sam', when: '2026-11-14T10:00:00.000Z', text: id });
const take = (seconds: number) => JSON.stringify({ by: 'Sam', at: 1, seconds, text: 'Hello' });

describe('listNotes opens only new comment files', () => {
  it('reads each file once, then only new names, and skips a half-synced one until it is whole', async () => {
    const comments: Tree = { 'a.json': note('a'), 'b.json': '{"v": 1, "id"' };
    const { dir, reads } = folder({ '.studio': { comments } });
    expect((await listNotes(dir)).map((n) => n.id)).toEqual(['a']);
    comments['b.json'] = note('b');
    comments['c.json'] = note('c');
    expect((await listNotes(dir)).map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect((await listNotes(dir)).map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(reads).toEqual({ '.studio/comments/a.json': 1, '.studio/comments/b.json': 2, '.studio/comments/c.json': 1 });
    delete comments['a.json'];
    expect((await listNotes(dir)).map((n) => n.id)).toEqual(['b', 'c']);
  });
});

describe('readTakes opens a take note again only when its date or size changes', () => {
  it('rereads a new take of the row, not the others', async () => {
    const voice: Tree = { 'row-a.json': take(2), 'row-a.webm': 'x', 'row-b.json': take(3) };
    const dates: Record<string, number> = {};
    const { dir, reads } = folder({ voice }, dates);
    expect(await readTakes(dir)).toMatchObject({ a: { seconds: 2 }, b: { seconds: 3 } });
    expect(await readTakes(dir)).toMatchObject({ a: { seconds: 2 }, b: { seconds: 3 } });
    voice['row-a.json'] = take(4);
    dates['voice/row-a.json'] = 2;
    expect(await readTakes(dir)).toMatchObject({ a: { seconds: 4 }, b: { seconds: 3 } });
    expect(reads).toEqual({ 'voice/row-a.json': 2, 'voice/row-b.json': 1 });
    delete voice['row-b.json'];
    expect(Object.keys(await readTakes(dir))).toEqual(['a']);
  });
});

describe('missingFiles lists each folder once', () => {
  const assets = (...paths: string[]) => paths.map((target) => ({ kind: 'path', target, label: target, rows: [1] })) as Parameters<typeof missingFiles>[1];

  it('finds the missing ones without a look-up for each file that is there', async () => {
    const { dir, looks } = folder({ assets: { 'a.png': '1', 'b.png': '2', 'c.png': '3' }, 'top.pdf': '4' });
    const lost = await missingFiles(dir, assets('assets/a.png', 'assets/b.png', 'assets/c.png', 'top.pdf', 'assets/gone.png', 'nowhere/x.png'));
    expect([...lost]).toEqual(['assets/gone.png', 'nowhere/x.png']);
    // One look-up per folder for its list (assets, nowhere), then gone.png looked up in the kept assets/ folder;
    // nowhere/ isn't there, so x.png is missing without another look-up (PF-17).
    expect(looks()).toBe(2 + 1);
  });

  it('still counts a file whose name differs only in case as there (as Windows does)', async () => {
    const { dir } = folder({ assets: { 'Leaf.png': '1' } });
    const caseless = dir.getDirectoryHandle.bind(dir);
    const assetsDir = await caseless('assets');
    const getFileHandle = assetsDir.getFileHandle.bind(assetsDir);
    assetsDir.getFileHandle = (name: string) => getFileHandle(name === 'leaf.png' ? 'Leaf.png' : name);
    dir.getDirectoryHandle = async () => assetsDir;
    expect([...(await missingFiles(dir, assets('assets/leaf.png')))]).toEqual([]);
  });
});
