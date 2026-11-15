import { describe, expect, it } from 'vitest';
import { captionAt, frameSize, itemAt, megabytes, wrap } from '../../src/lib/video';
import { shapeOf, withShape } from '../../src/lib/timeline';
import type { Plan } from '../../src/lib/editxml';

describe('the video (SB-3)', () => {
  it('is wide or upright at 720p or 1080p', () => {
    expect(frameSize('1080', 'wide')).toEqual({ width: 1920, height: 1080 });
    expect(frameSize('720', 'wide')).toEqual({ width: 1280, height: 720 });
    expect(frameSize('1080', 'upright')).toEqual({ width: 1080, height: 1920 });
    expect(frameSize('720', 'upright')).toEqual({ width: 720, height: 1280 });
  });

  it('guesses its size from its length', () => {
    expect(megabytes(60, '1080')).toBe(20); // (2.5 + 0.128) Mbit/s for a minute
    expect(megabytes(60, '720')).toBe(10);
    expect(megabytes(0, '720')).toBe(1);
  });

  it('finds the clip on screen at a moment, and none in a gap or after the end', () => {
    const items = [{ name: 'a', start: 0, seconds: 2 }, { name: 'b', start: 2, seconds: 3 }, { name: 'c', start: 6, seconds: 1 }];
    expect(itemAt(items, 0)).toBe(0);
    expect(itemAt(items, 1.99)).toBe(0);
    expect(itemAt(items, 2)).toBe(1);
    expect(itemAt(items, 5.5)).toBe(-1);
    expect(itemAt(items, 6.5)).toBe(2);
    expect(itemAt(items, 7)).toBe(-1);
    expect(itemAt([], 0)).toBe(-1);
  });

  it("shows the row's dialogue as the caption while the row plays", () => {
    const plan = { captions: [{ start: 0, seconds: 2, text: 'One.' }, { start: 4, seconds: 2, text: 'Two.' }] } as unknown as Plan;
    expect(captionAt(plan, 1)).toBe('One.');
    expect(captionAt(plan, 3)).toBe(''); // a hold
    expect(captionAt(plan, 4)).toBe('Two.');
  });

  it('wraps a caption to at most three lines', () => {
    const measure = (s: string) => s.length;
    expect(wrap('one two three', 20, measure)).toEqual(['one two three']);
    expect(wrap('one two three', 8, measure)).toEqual(['one two', 'three']);
    expect(wrap('a b c d e f g h', 3, measure)).toEqual(['a b', 'c d', 'e f…']);
  });

  it('keeps its shape in the front matter: upright written, wide left out', () => {
    expect(shapeOf(null)).toBe('wide');
    expect(shapeOf('title: X\nshape: upright')).toBe('upright');
    expect(withShape('title: X', 'upright')).toBe('title: X\nshape: upright');
    expect(withShape('title: X\nshape: upright', 'wide')).toBe('title: X');
    expect(withShape('shape: upright', 'wide')).toBe(null);
    expect(withShape(null, 'upright')).toBe('shape: upright');
  });
});
