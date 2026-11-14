import { describe, expect, it } from 'vitest';
import { listVersions, sinceSend } from '../../src/lib/history';
import { forMe } from '../../src/lib/forme';

// A script folder in memory that counts how often each file's text is read.
function script(files: Record<string, string>) {
  const reads: Record<string, number> = {};
  const versions = {
    async *keys() {
      yield* Object.keys(files);
    },
    async getFileHandle(name: string) {
      if (!(name in files)) throw new DOMException('Gone', 'NotFoundError');
      const text = files[name];
      return {
        getFile: async () => ({
          size: text.length,
          lastModified: 1,
          text: async () => ((reads[name] = (reads[name] ?? 0) + 1), text),
        }),
      };
    },
  };
  const dir = { getDirectoryHandle: async () => ({ getDirectoryHandle: async () => versions }) };
  return { dir: dir as unknown as FileSystemDirectoryHandle, reads };
}
const file = (id: string, when: string) =>
  JSON.stringify({ v: 1, id, parents: [], who: 'Sam', when, kind: 'edit', note: '', sha256: '', text: id });

describe('listVersions remembers what it read (HI-3)', () => {
  it('reads each file once, then only new ones', async () => {
    const files: Record<string, string> = {
      '20261109T144100Z_aaaaaaaa.json': file('aaaaaaaa', '2026-11-09T14:41:00Z'),
      '20261109T150000Z_bbbbbbbb.json': file('bbbbbbbb', '2026-11-09T15:00:00Z'),
    };
    const { dir, reads } = script(files);
    expect((await listVersions(dir)).map((v) => v.id)).toEqual(['aaaaaaaa', 'bbbbbbbb']);
    expect((await listVersions(dir)).map((v) => v.id)).toEqual(['aaaaaaaa', 'bbbbbbbb']);
    files['20261109T160000Z_cccccccc.json'] = file('cccccccc', '2026-11-09T16:00:00Z');
    expect((await listVersions(dir)).map((v) => v.id)).toEqual(['aaaaaaaa', 'bbbbbbbb', 'cccccccc']);
    expect(reads).toEqual({ '20261109T144100Z_aaaaaaaa.json': 1, '20261109T150000Z_bbbbbbbb.json': 1, '20261109T160000Z_cccccccc.json': 1 });
  });

  it('reads a half-synced file again until it is whole', async () => {
    const name = '20261109T144100Z_aaaaaaaa.json';
    const files: Record<string, string> = { [name]: '{"v": 1, "id": "aaa' };
    const { dir, reads } = script(files);
    expect(await listVersions(dir)).toEqual([]);
    files[name] = file('aaaaaaaa', '2026-11-09T14:41:00Z');
    expect((await listVersions(dir)).map((v) => v.id)).toEqual(['aaaaaaaa']);
    expect(reads[name]).toBe(2);
  });

  it('leaves out a file that is gone', async () => {
    const files: Record<string, string> = { '20261109T144100Z_aaaaaaaa.json': file('aaaaaaaa', '2026-11-09T14:41:00Z') };
    const { dir } = script(files);
    await listVersions(dir);
    delete files['20261109T144100Z_aaaaaaaa.json'];
    expect(await listVersions(dir)).toEqual([]);
  });
});

describe('sinceSend reads History back to the newest send only (PF-3)', () => {
  const stamp = (i: number) => `202611${String(10 + Math.floor(i / 24)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}0000Z`;
  const iso = (i: number) => stamp(i).replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z');
  const entry = (i: number, extra: object = {}) =>
    JSON.stringify({ v: 1, id: `v${String(i).padStart(7, '0')}`, parents: [], who: 'Ana', when: iso(i), kind: 'edit', note: '', sha256: '', text: '', ...extra });
  const send = { kind: 'review', note: 'Sent for review', who: 'Kiva' };
  const history = (n: number, sends: number[]) => {
    const files: Record<string, string> = {};
    for (let i = 0; i < n; i++) files[`${stamp(i)}_v${String(i).padStart(7, '0')}.json`] = entry(i, sends.includes(i) ? send : {});
    return files;
  };

  it('stops at the newest send, without opening the older files', async () => {
    const { dir, reads } = script(history(200, [20, 120]));
    const ids = (await sinceSend(dir)).map((v) => v.id);
    expect(ids[0]).toBe('v0000120');
    expect(ids).toHaveLength(80);
    expect(Object.keys(reads).length).toBeLessThan(110);
    expect(Object.keys(reads).some((name) => name.startsWith(stamp(20)))).toBe(false);
  });

  it('keeps a version made in the same second as the send', async () => {
    const files = history(60, [30]);
    files[`${stamp(30)}_a0000000.json`] = JSON.stringify({ ...JSON.parse(entry(30)), id: 'a0000000', parents: ['v0000030'] });
    const versions = await sinceSend(script(files).dir);
    expect(versions.slice(0, 2).map((v) => v.id)).toEqual(['v0000030', 'a0000000']);
  });

  it('reads everything when nothing was sent', async () => {
    expect(await sinceSend(script(history(60, [])).dir)).toHaveLength(60);
  });

  it('gives For me the same answers as the whole History', async () => {
    const files = history(120, [10, 70]);
    files[`${stamp(100)}_v0000100.json`] = entry(100, { kind: 'official', note: 'v1' });
    files[`${stamp(110)}_v0000110.json`] = entry(110, { kind: 'review', note: 'Sent back to writer' });
    const all = await listVersions(script(files).dir);
    const tail = await sinceSend(script(files).dir);
    const held = [{ v: 1, id: 'c1', kind: 'comment', who: 'Kiva', when: iso(50), text: 'x', row: 'r', field: 'dialogue' },
      { v: 1, id: 'r1', kind: 'reply', about: 'c1', who: 'Ana', when: iso(51), text: 'y' },
      { v: 1, id: 'h1', kind: 'hold', about: 'c1', who: 'Ana', when: iso(80) }] as never;
    for (const me of ['Kiva', 'Ana'])
      for (const status of ['draft', 'in review']) expect(forMe(me, status, tail, held)).toEqual(forMe(me, status, all, held));
  });
});
