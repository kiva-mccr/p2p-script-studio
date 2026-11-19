import { describe, expect, it } from 'vitest';
import { waiting, type BackNote } from '../../src/lib/backnotes';

const note = (id: string, made: string, extra: Partial<BackNote> = {}): BackNote =>
  ({ v: 1, id, by: 'Ana', who: 'Ana', when: made, made, text: id, ...extra });

describe('waiting (#248)', () => {
  it('keeps notes added since the round began, oldest first, leaving out deleted ones', () => {
    const notes = new Map([
      ['old', note('old', '2026-11-18T10:00:00.000Z')],
      ['b', note('b', '2026-11-19T10:05:00.000Z')],
      ['a', note('a', '2026-11-19T10:01:00.000Z')],
      ['gone', note('gone', '2026-11-19T10:02:00.000Z', { removed: true })],
    ]);
    expect(waiting(notes, '2026-11-19T10:00:00Z').map((n) => n.id)).toEqual(['a', 'b']);
  });
  it('a tick made later on an older note does not bring it back', () => {
    const ticked = note('old', '2026-11-18T10:00:00.000Z', { when: '2026-11-19T11:00:00.000Z', who: 'Sam' });
    expect(waiting(new Map([['old', ticked]]), '2026-11-19T10:00:00Z')).toEqual([]);
  });
  it('with no send for review in History, every note counts', () => {
    expect(waiting(new Map([['old', note('old', '2026-11-18T10:00:00.000Z')]]), '').map((n) => n.id)).toEqual(['old']);
  });
});
