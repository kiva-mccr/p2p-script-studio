// A speaker per row (#221): the Speaker: line, the credits' short names, and where they show.
import { describe, expect, it } from 'vitest';
import example from '../../docs/example/Episode 03 - How Photosynthesis Works/script.md?raw';
import { diff, fold } from '../../src/lib/changes';
import { toFdx } from '../../src/lib/fdx';
import { toFountain } from '../../src/lib/fountain';
import { merge } from '../../src/lib/merge';
import { readCredits, shortName, speakers, writeCredits } from '../../src/lib/people';
import { parseScript, rows, writeScript } from '../../src/lib/script';

const sugar = '## 4 <!-- id: b6n0w -->\nDialogue:';
const withAna = example.replace(sugar, '## 4 <!-- id: b6n0w -->\nSpeaker: Ana\n\nDialogue:');

describe('the Speaker: line', () => {
  it('is read before Dialogue and written back exactly', () => {
    const script = parseScript(withAna);
    expect(rows(script).map((r) => r.speaker)).toEqual(['', '', '', 'Ana', '']);
    expect(rows(script)[3].dialogue).toBe('They turn it into sugar the plant uses to grow.');
    expect(writeScript(script)).toBe(withAna);
  });

  it('leaves an older script with no speakers exactly as it was: every row is the narrator', () => {
    const script = parseScript(example);
    expect(rows(script).every((r) => r.speaker === '')).toBe(true);
    expect(writeScript(script)).toBe(example);
  });

  it('goes after a note on the row, and a dialogue line starting "Speaker:" is escaped', () => {
    const script = parseScript('## 1 <!-- id: aaaaa -->\nA note\n\nSpeaker:   Leo  \nDialogue:\nHi\n');
    const row = rows(script)[0];
    expect([row.note, row.speaker, row.dialogue]).toEqual(['A note', 'Leo', 'Hi']);
    row.dialogue = 'Speaker: the one at the front.';
    const text = writeScript(script);
    expect(text).toContain('A note\n\nSpeaker: Leo\n\nDialogue:\n\\Speaker: the one at the front.');
    expect(rows(parseScript(text))[0]).toMatchObject({ speaker: 'Leo', dialogue: 'Speaker: the one at the front.' });
  });
});

describe("the credits' short names", () => {
  it('are kept only when set, so a script with no speakers reads as before', () => {
    const front = writeCredits('title: T', [{ id: 'a', name: 'Ana Lima', role: 'Reviewer', as: ' Ana ' }, { id: 'k', name: 'Kiva', role: 'Writer', as: '' }]);
    expect(front).toBe('title: T\ncredits: [{"id":"a","name":"Ana Lima","role":"Reviewer","as":"Ana"},{"id":"k","name":"Kiva","role":"Writer"}]');
    expect(readCredits(front)[0].as).toBe('Ana');
    expect(readCredits(front)[1]).not.toHaveProperty('as');
    expect(speakers(front)).toEqual(['Ana']);
    expect(speakers('title: T')).toEqual([]);
  });

  it('are one short line', () => {
    expect(shortName('  Ana \n Lima ')).toBe('Ana Lima');
    expect(shortName('x'.repeat(40))).toHaveLength(24);
  });
});

describe('screenplays', () => {
  const script = parseScript(withAna);
  it('Fountain puts each row under its speaker, the rest under the narrator', () => {
    const out = toFountain(script, 'T', 'Draft', 'Nov 19, 2026');
    expect(out).toContain('ANA\nThey turn it into sugar');
    expect(out).toContain('NARRATOR\nEvery leaf');
  });

  it('Final Draft does too', () => {
    const out = toFdx(script, 'T', 'Draft', 'Nov 19, 2026');
    expect(out).toContain('<Paragraph Type="Character"><Text>ANA</Text></Paragraph>\n<Paragraph Type="Dialogue"><Text>They turn it into sugar');
  });
});

describe('saving with others', () => {
  it('merges a speaker one side set with an edit the other made', () => {
    const theirs = example.replace('Slow push-in on a sunlit leaf.', 'Slow push-in on a leaf.');
    const merged = merge(example, withAna, theirs);
    expect(merged.clashes).toEqual([]);
    const out = parseScript(merged.text({}));
    expect(rows(out)[3].speaker).toBe('Ana');
    expect(rows(out)[0].onScreen).toBe('Slow push-in on a leaf.');
  });

  it('asks when both set a different speaker', () => {
    const leo = example.replace(sugar, '## 4 <!-- id: b6n0w -->\nSpeaker: Leo\n\nDialogue:');
    expect(merge(example, withAna, leo).clashes.map((c) => c.where)).toEqual(['Row 4 · Speaker']);
  });

  it("a change file carries the speaker, and an older one without it reads as the narrator's", () => {
    const delta = diff(example, withAna)!;
    expect(fold(delta, example).text({})).toBe(withAna);
    const old = JSON.parse(JSON.stringify(diff(example, example.replace('grow.', 'grow tall.'))));
    for (const pair of Object.values(old.rows) as [Record<string, unknown> | null, Record<string, unknown> | null][]) for (const d of pair) if (d) delete d.speaker;
    expect(rows(parseScript(fold(old, withAna).text({})))[3]).toMatchObject({ speaker: 'Ana', dialogue: 'They turn it into sugar the plant uses to grow tall.' });
  });
});
