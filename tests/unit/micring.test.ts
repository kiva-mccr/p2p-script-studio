import { describe, expect, it } from 'vitest';
import { MIN_GAP, micRing, ringLabel } from '../../src/lib/micring';

describe('micRing', () => {
  it('is nothing until a row has a take', () => {
    expect(micRing([])).toBeNull();
    expect(micRing([-10, -5, 0])).toBeNull();
  });
  it('is one full arc once every row is recorded, rows needing no take left out', () => {
    const ring = micRing([10, 0, 5, 1])!;
    expect(ring.arcs).toEqual([[0, 1]]);
    expect(ring).toMatchObject({ done: 3, of: 3, missing: [] });
    expect(ringLabel(ring)).toBe('recorded');
  });
  it('goes in script order, slices sized by words, a missing row a gap', () => {
    const ring = micRing([10, -10, 20])!;
    expect(ring.arcs).toEqual([[0, 0.25], [0.5, 1]]);
    expect(ring.missing).toEqual([2]);
    expect(ringLabel(ring)).toBe('2 of 3 rows recorded · missing: row 2');
  });
  it('keeps a short missing row visible: at least MIN_GAP of the ring', () => {
    const ring = micRing([100, -1, 100])!;
    const [first, second] = ring.arcs;
    expect(second[0] - first[1]).toBeCloseTo(MIN_GAP);
    expect(first[0]).toBe(0);
    expect(second[1]).toBeCloseTo(1);
  });
  it('numbers missing rows by their place in the script, cutting a long list short', () => {
    const ring = micRing([5, 0, -3, -3, -3, -3, -3, -3, -3])!;
    expect(ring.missing).toEqual([3, 4, 5, 6, 7, 8, 9]);
    expect(ringLabel(ring)).toBe('1 of 8 rows recorded · missing: row 3, 4, 5, 6, 7, 8…');
  });
  it('shares the ring out when the gaps alone would fill it', () => {
    const ring = micRing([1, ...Array(20).fill(-1)])!;
    expect(ring.arcs[0][0]).toBe(0);
    expect(ring.arcs[0][1]).toBeCloseTo(1 / 21 / (1 / 21 + 20 * MIN_GAP)); // everything scaled down together
  });
});
