import { describe, expect, it } from 'vitest';
import { eachAtOnce } from '../../src/lib/atonce';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('eachAtOnce', () => {
  it('runs at most the limit at a time and keeps the order', async () => {
    let running = 0;
    let most = 0;
    const out = await eachAtOnce([30, 5, 20, 1, 15, 2, 9, 4, 12, 3, 7], async (ms, i) => {
      most = Math.max(most, ++running);
      await wait(ms);
      running--;
      return i * 10;
    }, 3);
    expect(most).toBe(3);
    expect(out).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it('waits far less than one at a time', async () => {
    const start = performance.now();
    await eachAtOnce(Array.from({ length: 16 }, () => 20), (ms) => wait(ms));
    expect(performance.now() - start).toBeLessThan(160); // one at a time: 320 ms; eight at once: about 40
  });

  it('gives nothing for no items', async () => {
    expect(await eachAtOnce([], async () => 1)).toEqual([]);
  });

  it('fails with the first failure and starts nothing after it', async () => {
    const started: number[] = [];
    await expect(eachAtOnce([1, 2, 3, 4, 5], async (n) => {
      started.push(n);
      await wait(1);
      if (n === 2) throw new Error('bad');
    }, 2)).rejects.toThrow('bad');
    expect(started).not.toContain(5);
  });
});
