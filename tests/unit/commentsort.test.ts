import { describe, expect, it } from 'vitest';
import { threads, type Note } from '../../src/lib/comments';
import { heading, newestResolved, sortThreads, toSort } from '../../src/lib/commentsort';
import type { Row } from '../../src/lib/script';

const row = (id: string, dialogue: string, onScreen = ''): Row => ({ type: 'row', speaker: '', id, dialogue, onScreen, files: [] }) as unknown as Row;
const rows = [row('r1', 'Every leaf is a tiny kitchen.', 'A sunlit leaf.'), row('r2', 'It needs sunlight and water.')];
const note = (id: string, kind: Note['kind'], min: string, extra: Partial<Note>): Note => ({
  v: 1, id, kind, who: 'Ana', when: `2026-11-09T14:${min}:00Z`, ...extra,
});
const list = threads([
  note('words2', 'comment', '00', { row: 'r2', field: 'dialogue', quote: 'water', text: 'x' }),
  note('screen1', 'comment', '01', { row: 'r1', field: 'on_screen', quote: 'sunlit', text: 'x' }),
  note('gone', 'comment', '02', { row: 'deleted', field: 'dialogue', quote: 'old', text: 'x' }),
  note('late1', 'comment', '03', { row: 'r1', field: 'dialogue', quote: 'kitchen', text: 'x' }),
  note('whole2', 'comment', '04', { row: 'r2', field: 'dialogue', quote: '', text: 'x' }),
  note('early1', 'suggestion', '05', { row: 'r1', field: 'dialogue', quote: 'Every', replace: 'Each' }),
  note('whole1', 'comment', '06', { row: 'r1', text: 'x' }),
]);
const ids = (how: 'line' | 'time' | 'type') => sortThreads(list, how, rows).map((t) => t.comment.id);

describe('sortThreads (RV-16)', () => {
  it('in line order: by row, the whole row first, then by column and place in the text, deleted rows last', () => {
    expect(ids('line')).toEqual(['whole1', 'early1', 'late1', 'screen1', 'whole2', 'words2', 'gone']);
  });
  it('by time: newest first', () => {
    expect(ids('time')).toEqual(['whole1', 'early1', 'whole2', 'late1', 'gone', 'screen1', 'words2']);
  });
  it('by type: suggestions, comments on words, comments on a whole row, each in line order, with headings', () => {
    const sorted = sortThreads(list, 'type', rows);
    expect(sorted.map((t) => t.comment.id)).toEqual(['early1', 'late1', 'screen1', 'words2', 'gone', 'whole1', 'whole2']);
    expect(sorted.map((_, i) => heading(sorted, i, 'type'))).toEqual(['Suggestions · 1', 'On words · 4', '', '', '', 'On a whole row · 2', '']);
    expect(heading(sorted, 0, 'line')).toBe('');
  });
  it('reads a remembered choice, Line when there is none', () => {
    expect([toSort(''), toSort('time'), toSort('type'), toSort('odd')]).toEqual(['line', 'time', 'type', 'line']);
  });
});

describe('newestResolved (RV-25)', () => {
  const done = (id: string, kind: Note['kind'], min: string, about: string, extra: Partial<Note> = {}) => note(id, kind, min, { about, ...extra });
  const resolved = threads([
    note('a', 'comment', '00', { row: 'r1', text: 'x' }),
    note('b', 'suggestion', '01', { row: 'r2', field: 'dialogue', quote: 'water', replace: 'rain' }),
    note('c', 'comment', '02', { row: 'gone', text: 'x' }),
    note('d', 'comment', '03', { row: 'r1', text: 'x' }),
    done('ra', 'resolve', '10', 'a'),
    done('rb', 'accept', '20', 'b'),
    done('rc', 'resolve', '30', 'c', { why: 'deleted', after: 'r1' }),
    done('rd', 'resolve', '05', 'd'),
    done('od', 'reopen', '06', 'd'),
    done('rd2', 'resolve', '40', 'd'),
  ]);
  it('puts the newest resolved first, a resolve by deleting the row too, whatever the switch says', () => {
    expect(newestResolved(resolved).map((t) => t.comment.id)).toEqual(['d', 'c', 'b', 'a']);
    expect(newestResolved(sortThreads(resolved, 'type', rows)).map((t) => t.comment.id)).toEqual(['d', 'c', 'b', 'a']);
  });
  it('keeps a deleted row\'s place in line order once its comment is reopened (RV-24)', () => {
    const reopened = threads([
      note('c', 'comment', '02', { row: 'gone', text: 'x' }),
      note('e', 'comment', '03', { row: 'r2', text: 'x' }),
      done('rc', 'resolve', '30', 'c', { why: 'deleted', after: 'r1' }),
      done('oc', 'reopen', '31', 'c'),
    ]);
    expect(reopened[1]).toMatchObject({ resolved: false, after: 'r1', done: undefined });
    expect(sortThreads(reopened, 'line', rows).map((t) => t.comment.id)).toEqual(['c', 'e']);
  });
});
