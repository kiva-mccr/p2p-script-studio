import { afterEach, describe, expect, it, vi } from 'vitest';
import { Undo } from '../../src/lib/undo.svelte';

describe('Undo (UX-1)', () => {
  afterEach(() => vi.useRealTimers());

  it('offers the newest action for 10 seconds, and Undo runs it once', async () => {
    vi.useFakeTimers();
    const undo = new Undo();
    const back = vi.fn();
    undo.offer({ what: 'Row 1 deleted.', back: () => {} });
    undo.offer({ what: 'Take of row 2 deleted.', back });
    expect(undo.shown?.what).toBe('Take of row 2 deleted.');
    await Promise.all([undo.take(), undo.take()]);
    expect(back).toHaveBeenCalledTimes(1);
    expect(undo.shown).toBeNull();
    undo.offer({ what: 'Again.', back });
    vi.advanceTimersByTime(9999);
    expect(undo.shown).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(undo.shown).toBeNull();
  });
});
