import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { threads, type Note } from '../../src/lib/comments';
import type { Version } from '../../src/lib/history';
import { placeComments, stateText } from '../../src/lib/historycomments';

const version = (id: string, parent: string, when: string, text: string): Version => ({
  v: 1, id, parents: parent ? [parent] : [], who: 'Sam', when: `2026-11-09T${when}Z`, kind: 'edit', note: '', sha256: '', text,
});
const note = (id: string, kind: Note['kind'], when: string, extra: Partial<Note> = {}): Note => ({
  v: 1, id, kind, who: 'Ana', when: `2026-11-09T${when}.500Z`, ...extra,
});

const absorb = example.replace('chloroplasts catch the light', 'chloroplasts absorb the light');
const fade = absorb.replace('slide in one at a time', 'fade in one at a time');
const versions = [
  version('one', '', '10:00:00', example),
  version('two', 'one', '11:00:00', absorb),
  version('three', 'two', '12:00:00', fade),
];

describe('placeComments', () => {
  it('puts a comment under the first change to its cell after it, else on the version current when it was made', () => {
    const placed = placeComments(versions, threads([
      note('c', 'comment', '10:30:00', { row: 't1q7c', field: 'dialogue', quote: 'catch', text: 'Absorb?' }),
      note('s', 'suggestion', '10:40:00', { row: 'p8x2m', field: 'on_screen', quote: 'slide in', replace: 'fade in' }),
      note('o', 'comment', '11:30:00', { row: 'k3f9a', field: 'on_screen', quote: '', text: 'Real leaf?' }),
      note('e', 'comment', '09:00:00', { row: 'k3f9a', field: 'dialogue', text: 'Before History' }),
      note('x', 'comment', '10:10:00', { row: 'b6n0w', field: 'dialogue', text: 'Deleted' }),
      note('d', 'delete', '10:11:00', { about: 'x' }),
    ]));
    expect([...placed.get('two')!.changed]).toEqual([['t1q7c:dialogue', [expect.objectContaining({ comment: expect.objectContaining({ id: 'c' }) })]]]);
    // made before "two", but "two" didn't touch row 2's On screen: "three" did
    expect([...placed.get('three')!.changed.keys()]).toEqual(['p8x2m:on_screen']);
    expect(placed.get('two')!.open.map((t) => t.comment.id)).toEqual(['o']);
    expect(placed.get('one')!.open.map((t) => t.comment.id)).toEqual(['e']); // older than every version
    expect(placed.get('one')!.changed.size).toBe(0);
  });

  it('counts a removed row as a change to each of its cells', () => {
    const removed = example.replace(/## 2 <!-- id: p8x2m -->[\s\S]*?(?=# Inside)/, '');
    const placed = placeComments([versions[0], version('gone', 'one', '11:00:00', removed)], threads([
      note('c', 'comment', '10:30:00', { row: 'p8x2m', field: 'files', text: 'Wrong icons' }),
    ]));
    expect([...placed.get('gone')!.changed.keys()]).toEqual(['p8x2m:files']);
  });
});

describe('placeComments for the shown versions only (PF-4)', () => {
  // Six versions, each changing one cell; comments made all along. The newest three are "shown".
  const edits: [string, string][] = [
    ['chloroplasts catch the light', 'chloroplasts absorb the light'],
    ['slide in one at a time', 'fade in one at a time'],
    ['chloroplasts absorb the light', 'chloroplasts take in the light'],
    ['fade in one at a time', 'pop in one at a time'],
    ['Slow push-in on a sunlit leaf', 'Slow push-in on a green leaf'],
  ];
  const six = [version('v0', '', '10:00:00', example)];
  edits.forEach(([a, b], i) => six.push(version(`v${i + 1}`, `v${i}`, `1${i + 1}:00:00`, six[i].text.replace(a, b))));
  const list = threads([
    note('a', 'comment', '10:30:00', { row: 't1q7c', field: 'dialogue', text: 'changed by v1, not shown' }),
    note('b', 'comment', '10:40:00', { row: 'k3f9a', field: 'on_screen', text: 'changed only by v5' }),
    note('c', 'comment', '11:30:00', { row: 'p8x2m', field: 'on_screen', text: 'changed by v2, not shown' }),
    note('d', 'comment', '12:30:00', { row: 't1q7c', field: 'dialogue', text: 'changed by v3' }),
    note('e', 'comment', '10:50:00', { row: 'b6n0w', field: 'dialogue', text: 'never changed: on v0' }),
    note('f', 'comment', '14:30:00', { row: 'b6n0w', field: 'dialogue', text: 'never changed: on v4' }),
    note('g', 'comment', '11:10:00', { text: 'whole script, on v1' }),
  ]);
  const ids = (p: ReturnType<typeof placeComments>, id: string) => {
    const got = p.get(id);
    return got && { open: got.open.map((t) => t.comment.id), changed: [...got.changed].map(([k, l]) => [k, l.map((t) => t.comment.id)]) };
  };

  it('gives the shown versions the same comments as placing them all would', () => {
    const all = placeComments(six, list);
    for (const from of [0, 1, 2, 3, 4, 5, 6]) {
      const some = placeComments(six, list, from);
      expect([...some.keys()]).toEqual(six.slice(from).map((v) => v.id));
      for (const v of six.slice(from)) expect(ids(some, v.id)).toEqual(ids(all, v.id));
    }
    expect(ids(all, 'v5')!.changed).toEqual([['k3f9a:on_screen', ['b']]]);
    expect(ids(all, 'v3')!.changed).toEqual([['t1q7c:dialogue', ['d']]]);
    expect(ids(all, 'v4')!.open).toEqual(['f']);
  });

  it('still counts a change made and undone before the shown versions', () => {
    // v1 changes row 3's Dialogue, v2 puts it back (a restore), v3 changes it again: a comment made before v1 is v1's.
    const changed = example.replace('chloroplasts catch the light', 'chloroplasts absorb the light');
    const four = [example, changed, example, changed.replace('absorb', 'take in')].map((text, i) =>
      version(`r${i}`, i ? `r${i - 1}` : '', `1${i}:00:00`, text));
    const one = threads([note('a', 'comment', '09:30:00', { row: 't1q7c', field: 'dialogue', text: 'Absorb?' })]);
    expect([...placeComments(four, one).get('r1')!.changed.keys()]).toEqual(['t1q7c:dialogue']);
    expect(placeComments(four, one, 3).get('r3')!.changed.size).toBe(0);
  });

  it('reads rows the way the script is read: Windows line ends, rows without an id, moved and removed rows', () => {
    const crlf = example.replace(/\n/g, '\r\n');
    const moved = example.replace(/(## 2 <!-- id: p8x2m -->[\s\S]*?)(?=# Inside)/, '').replace('# Inside', (m) => `## 9 <!-- id: p8x2m -->\nDialogue:\n${'x'}\n\n${m}`);
    const vs = [version('w0', '', '10:00:00', example), version('w1', 'w0', '11:00:00', crlf), version('w2', 'w1', '12:00:00', moved)];
    const list = threads([note('c', 'comment', '10:30:00', { row: 'p8x2m', field: 'dialogue', text: 'x' })]);
    const placed = placeComments(vs, list);
    expect(placed.get('w1')!.changed.size).toBe(0); // only the line ends changed
    expect([...placed.get('w2')!.changed.keys()]).toEqual(['p8x2m:dialogue']);
  });
});

describe('stateText', () => {
  it('says where a comment or suggestion stands, and who decided', () => {
    const list = threads([
      note('a', 'comment', '10:00:00'),
      note('b', 'comment', '10:01:00'),
      note('s', 'suggestion', '10:02:00', { quote: 'x', replace: 'y' }),
      note('r', 'resolve', '10:03:00', { about: 'b', who: 'Sam' }),
      note('k', 'accept', '10:04:00', { about: 's', who: 'Sam' }),
    ]);
    expect(list.map(stateText)).toEqual(['Accepted by Sam', 'Resolved by Sam', 'Open']);
  });
});
