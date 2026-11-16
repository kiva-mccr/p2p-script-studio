import { afterEach, describe, expect, it, vi } from 'vitest';
import { Undo } from '../../src/lib/undo.svelte';

describe('Undo (UX-1)', () => {
  afterEach(() => vi.useRealTimers());

  it('offers the newest action for 5 seconds, and Undo runs it once', async () => {
    vi.useFakeTimers();
    const undo = new Undo();
    expect(undo.ms).toBe(5000);
    const back = vi.fn();
    undo.offer({ what: 'Row 1 deleted.', back: () => {} });
    undo.offer({ what: 'Take of row 2 deleted.', back });
    expect(undo.shown?.what).toBe('Take of row 2 deleted.');
    await Promise.all([undo.take(), undo.take()]);
    expect(back).toHaveBeenCalledTimes(1);
    expect(undo.shown).toBeNull();
    undo.offer({ what: 'Again.', back });
    vi.advanceTimersByTime(4999);
    expect(undo.shown).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(undo.shown).toBeNull();
  });

  it('goes when the person carries on, but not for Tab, a modifier or the toast itself', () => {
    const undo = new Undo();
    const page = { closest: () => null } as unknown as EventTarget;
    const toast = { closest: (s: string) => (s === '[data-undo]' ? {} : null) } as unknown as EventTarget;
    undo.offer({ what: 'Row 1 deleted.', back: () => {} });
    undo.carryOn({ key: 'Tab', target: page });
    undo.carryOn({ key: 'Shift', target: page });
    undo.carryOn({ target: toast });
    undo.carryOn({ key: 'Enter', target: toast });
    expect(undo.shown).not.toBeNull();
    undo.carryOn({ key: 'a', target: page });
    expect(undo.shown).toBeNull();
    undo.offer({ what: 'Row 2 deleted.', back: () => {} });
    undo.carryOn({ target: page }); // a click elsewhere
    expect(undo.shown).toBeNull();
    undo.clear();
  });
});
