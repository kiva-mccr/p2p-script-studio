import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { autoResolve, changed } from '../../src/lib/autoresolve';
import { threads, type Note } from '../../src/lib/comments';
import { sortThreads } from '../../src/lib/commentsort';
import { parseScript, rows, writeScript } from '../../src/lib/script';

const flat = (text: string) => text;
const note = (id: string, kind: Note['kind'], min: string, extra: Partial<Note> = {}): Note => ({
  v: 1, id, kind, who: 'Ana', when: `2026-11-09T14:${min}:00.000Z`, ...extra,
});
const edit = (text: string, change: (s: ReturnType<typeof parseScript>) => void) => {
  const s = parseScript(text);
  change(s);
  return writeScript(s);
};
const second = rows(parseScript(example))[1];
const without = edit(example, (s) => (s.blocks = s.blocks.filter((b) => b.type !== 'row' || b.id !== second.id)));
const quote = second.dialogue.split(' ').slice(1, 3).join(' ');

describe('autoResolve (RV-24, #249)', () => {
  const comments = [
    note('whole', 'comment', '00', { row: second.id, text: 'Too long' }),
    note('words', 'suggestion', '01', { row: second.id, field: 'dialogue', quote, replace: 'x' }),
    note('other', 'comment', '02', { row: 'k3f9a', text: 'Fine' }),
    note('done', 'comment', '03', { row: second.id, text: 'Old' }),
    note('r', 'resolve', '04', { about: 'done' }),
  ];

  it('a deleted row resolves its open comments and suggestions, keeping its words and its place', () => {
    const got = autoResolve(threads(comments), example, without, 'Sam', flat);
    expect(got.map((e) => e.about).sort()).toEqual(['whole', 'words']);
    expect(got[0]).toMatchObject({ kind: 'resolve', who: 'Sam', why: 'deleted', was: second.dialogue, n: 2, after: 'k3f9a' });
  });

  it('Undo of the delete reopens them, and only them', () => {
    const resolved = autoResolve(threads(comments), example, without, 'Sam', flat).map((e, i) => note(`a${i}`, 'resolve', '05', e));
    const list = threads([...comments, ...resolved]);
    expect(list.filter((t) => t.resolved && t.gone).map((t) => t.comment.id).sort()).toEqual(['whole', 'words']);
    const back = autoResolve(list, without, example, 'Sam', flat);
    expect(back.map((e) => [e.kind, e.about]).sort()).toEqual([['reopen', 'whole'], ['reopen', 'words']]);
    expect(threads([...comments, ...resolved, ...back.map((e, i) => note(`b${i}`, 'reopen', '06', e))]).find((t) => t.comment.id === 'whole')).toMatchObject({ resolved: false, gone: undefined });
  });

  it('a resolved comment on the deleted row is left alone, and nothing happens when the row stays', () => {
    expect(autoResolve(threads(comments), example, example, 'Sam', flat)).toEqual([]);
  });

  it('replaced words resolve the comments on them with the old and new words; putting them back reopens', () => {
    const replaced = edit(example, (s) => {
      const row = rows(s)[1];
      row.dialogue = row.dialogue.replace(quote, 'something else');
    });
    const got = autoResolve(threads(comments), example, replaced, 'Sam', flat);
    expect(got).toHaveLength(1);
    expect(got[0]).toMatchObject({ kind: 'resolve', about: 'words', why: 'replaced', was: quote, now: 'something else' });
    const list = threads([...comments, note('a', 'resolve', '05', got[0])]);
    expect(autoResolve(list, replaced, example, 'Sam', flat)).toEqual([{ kind: 'reopen', about: 'words', who: 'Sam' }]);
  });

  it('a resolved comment on a deleted row keeps its place in line order', () => {
    const resolved = autoResolve(threads(comments), example, without, 'Sam', flat).map((e, i) => note(`a${i}`, 'resolve', '05', e));
    const now = rows(parseScript(without));
    // After row 1 (where it was), not last; a comment resolved by hand on that row has no place and goes last.
    expect(sortThreads(threads([...comments, ...resolved]), 'line', now).map((t) => t.comment.id)).toEqual(['other', 'words', 'whole', 'done']);
  });
});

describe('changed', () => {
  it('the words around the quote that changed, as whole words', () => {
    expect(changed('Water is always moving.', 'Water keeps moving.', 'always')).toEqual(['is always', 'keeps']);
    expect(changed('Water is always moving.', 'Water is moving.', 'always')).toEqual(['always', '']);
    expect(changed('It falls as rain.', 'It falls as snow.', 'rain')).toEqual(['rain', 'snow']);
  });
});
