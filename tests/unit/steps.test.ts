import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseScript, writeScript, type Row } from '../../src/lib/script';
import { settle, Steps } from '../../src/lib/steps';

const script = (...rows: [string, string][]) =>
  writeScript({ front: 'title: T', intro: '', blocks: rows.map(([id, dialogue]) => ({ type: 'row', speaker: '', id, dialogue, onScreen: '', files: [], timeline: '', note: '' })) });

describe('Steps (Ctrl+Z and Ctrl+Y)', () => {
  afterEach(() => vi.useRealTimers());

  it('undoes and redoes each change in order, typing in one box as one step', () => {
    vi.useFakeTimers();
    const steps = new Steps();
    const a = script(['r1', 'leaf']);
    steps.reset(a);
    const box = {};
    const b = script(['r1', 'leaf s']);
    steps.note(b, box);
    vi.advanceTimersByTime(300);
    const c = script(['r1', 'leaf soon']);
    steps.note(c, box);
    const d = script(['r1', 'leaves soon']); // Replace all: a step of its own
    steps.note(d);
    expect(steps.undo(d)).toBe(c);
    expect(steps.undo(c)).toBe(a);
    expect(steps.undo(a)).toBeNull();
    expect(steps.redo(a)).toBe(c);
    expect(steps.redo(c)).toBe(d);
    expect(steps.redo(d)).toBeNull();
  });

  it('starts a new step after a pause, and a new change clears redo', () => {
    vi.useFakeTimers();
    const steps = new Steps();
    const box = {};
    const [a, b, c] = [script(['r1', '']), script(['r1', 'one']), script(['r1', 'one two'])];
    steps.reset(a);
    steps.note(b, box);
    vi.advanceTimersByTime(1500);
    steps.note(c, box);
    expect(steps.undo(c)).toBe(b);
    steps.note(script(['r1', 'onex']), box);
    expect(steps.canRedo).toBe(false);
  });

  it("keeps others' saves: undoing folds the step back into the page as it is now", () => {
    const steps = new Steps();
    const a = script(['r1', 'leaf'], ['r2', 'stem']);
    steps.reset(a);
    const b = script(['r1', 'leaves'], ['r2', 'stem']);
    steps.note(b);
    const theirs = script(['r1', 'leaves'], ['r2', 'stem and root']); // someone else's save, folded in
    steps.sync(theirs);
    expect(steps.undo(theirs)).toBe(script(['r1', 'leaf'], ['r2', 'stem and root']));
  });

  it('gives a clash, and drops the step, when someone else changed the same place since', () => {
    const steps = new Steps();
    const a = script(['r1', 'leaf']);
    steps.reset(a);
    steps.note(script(['r1', 'leaves']));
    const theirs = script(['r1', 'green leaves']);
    steps.sync(theirs);
    expect(steps.undo(theirs)).toBe('clash');
    expect(steps.canUndo).toBe(false);
  });
});

describe('Steps with acts (UX-15)', () => {
  it('keeps a take or flag in order with the text, and hands it back to run', () => {
    const steps = new Steps();
    const [a, b] = [script(['r1', 'one']), script(['r1', 'one two'])];
    steps.reset(a);
    const act = { back: async () => {}, again: async () => {}, row: 'r1' };
    steps.note(b);
    steps.act(act);
    expect(steps.isLast(act)).toBe(true);
    expect(steps.undo(b)).toBe(act);
    expect(steps.undo(b)).toBe(a);
    expect(steps.redo(a)).toBe(b);
    expect(steps.redo(b)).toBe(act);
  });
});

describe('settle', () => {
  it('changes the page in place, keeping the rows that stay, and says where the change is', () => {
    const page = parseScript(script(['r1', 'one'], ['r2', 'two'], ['r3', 'three']));
    const [r1, r2] = page.blocks as Row[];
    r1.dialogue = 'one '; // a space at the end, which the file doesn't keep
    const place = settle(page, writeScript(page), script(['r1', 'one'], ['r2', 'two leaves'], ['r3', 'three']));
    expect(page.blocks[0]).toBe(r1);
    expect(page.blocks[1]).toBe(r2);
    expect(r1.dialogue).toBe('one ');
    expect(r2.dialogue).toBe('two leaves');
    expect(place).toEqual({ index: 1, field: 'dialogue', at: 10 });
  });

  it('brings a deleted row back, and puts moved rows back in order', () => {
    const page = parseScript(script(['r1', 'one'], ['r3', 'three']));
    const [r1, r3] = page.blocks as Row[];
    const place = settle(page, writeScript(page), script(['r3', 'three'], ['r2', 'two'], ['r1', 'one']));
    expect(page.blocks.map((b) => (b as Row).id)).toEqual(['r3', 'r2', 'r1']);
    expect(page.blocks[0]).toBe(r3);
    expect(page.blocks[2]).toBe(r1);
    expect(place?.index).toBe(0);
  });

  it('keeps a section whose title changed, and points at its title', () => {
    const text = (title: string) => writeScript({ front: null, intro: '', blocks: [{ type: 'section', title, note: '' }, { type: 'row', speaker: '', id: 'r1', dialogue: 'x', onScreen: '', files: [], timeline: '', note: '' }] });
    const page = parseScript(text('Glucose basics'));
    const section = page.blocks[0];
    const place = settle(page, writeScript(page), text('Glucose'));
    expect(page.blocks[0]).toBe(section);
    expect(section).toMatchObject({ title: 'Glucose' });
    expect(place).toEqual({ index: 0, field: 'title', at: 7 });
  });
});
