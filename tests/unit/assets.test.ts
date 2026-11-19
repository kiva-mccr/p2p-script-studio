import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { assetList, assetRows, excerpt, stillToFind } from '../../src/lib/assets';
import { parseScript, type Row } from '../../src/lib/script';

describe('assetRows', () => {
  it('gives each row its section and its files, links and notes', () => {
    const rows = assetRows(parseScript(example));
    expect(rows.map((r) => [r.n, r.section, r.assets.map((a) => a.kind)])).toEqual([
      [1, 'Intro', ['path', 'path']], [2, 'Intro', ['path', 'path']], [3, 'Inside the leaf', ['link', 'path', 'path']],
      [4, 'Inside the leaf', ['path', 'path']], [5, 'Wrap-up', ['words', 'path', 'path']],
    ]);
  });
  it('lists an asset used twice once, with both rows', () => {
    const script = parseScript('# A\n\n## 1 <!-- id: a1 -->\nFiles:\n- assets/x.png\n\n## 2 <!-- id: a2 -->\nFiles:\n- assets/x.png\n- B-roll\n- b-roll\n');
    const list = assetList(script);
    expect(list.map((a) => [a.label, a.rows])).toEqual([['x.png', [1, 2]], ['B-roll', [2]]]);
  });
});

describe('excerpt', () => {
  const row = (dialogue: string, onScreen = ''): Row => ({ type: 'row', id: 'a', dialogue, onScreen, files: [], timeline: '', note: '' });
  it("is the row's dialogue on one line, marks taken out", () => {
    expect(excerpt(row('Inside each **cell**, *tiny* parts.\n\nThey are [green](https://x.org).'))).toBe('Inside each cell, tiny parts. They are green.');
  });
  it('drops bullets, numbers and tick boxes', () => {
    expect(excerpt(row('- one\n2. two\n- [x] three'))).toBe('one two three');
  });
  it('uses the On screen words when there is no dialogue', () => {
    expect(excerpt(row('  ', 'Drone shot of a river'))).toBe('Drone shot of a river');
    expect(excerpt(row('', ''))).toBe('');
  });
  it('gives each row of the example its excerpt', () => {
    expect(assetRows(parseScript(example))[0].excerpt).toBe('Every leaf you have ever seen is running a tiny factory.');
  });
});

describe('stillToFind', () => {
  it("lists a row's missing files by name and its notes, in the Files order, but not its files that are there or its links (#227)", () => {
    const row = { files: ['assets/river-drone.mp4', '[Map](https://example.com/map)', 'a map of the river (to find)', 'assets/leaf.jpg'] } as Row;
    expect(stillToFind(row, new Set(['assets/river-drone.mp4']))).toEqual(['river-drone.mp4', 'a map of the river (to find)']);
    expect(stillToFind(row, new Set())).toEqual(['a map of the river (to find)']);
  });
});
