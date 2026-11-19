import { describe, expect, it } from 'vitest';
import { fitBox, readBox, startBox } from '../../src/lib/floatbox';

const room = { left: 16, top: 60, right: 1264, bottom: 700 };
const wide = 9 / 16;

describe('fitBox', () => {
  it('leaves a box that fits as it is', () => {
    expect(fitBox({ x: 100, y: 100, w: 480 }, room, wide, 40)).toEqual({ x: 100, y: 100, w: 480 });
  });
  it('moves a box back inside the room', () => {
    expect(fitBox({ x: 1200, y: 690, w: 480 }, room, wide, 40)).toEqual({ x: 1264 - 480, y: 700 - 310, w: 480 });
    expect(fitBox({ x: -50, y: 0, w: 480 }, room, wide, 40)).toEqual({ x: 16, y: 60, w: 480 });
  });
  it('shrinks a box taller than the room, keeping its shape', () => {
    const b = fitBox({ x: 16, y: 60, w: 2000 }, room, wide, 40);
    expect(b.w).toBe(Math.round((640 - 40) / wide));
    expect(b.y).toBe(60);
  });
  it('never makes it smaller than the least width, unless the room is smaller', () => {
    expect(fitBox({ x: 16, y: 60, w: 50 }, room, wide, 40).w).toBe(200);
    expect(fitBox({ x: 16, y: 60, w: 50 }, { ...room, bottom: 300 }, 16 / 9, 40).w).toBe(Math.round(200 / (16 / 9)));
  });
});

describe('startBox', () => {
  it('sits in the bottom right corner', () => {
    const b = startBox(room, wide, 40, 720);
    expect(b.w).toBe(720);
    expect(b.x + b.w).toBe(1264);
    expect(b.y + Math.round(720 * wide) + 40).toBe(700);
  });
  it('is only as wide as fits', () => {
    const b = startBox({ ...room, bottom: 400 }, 16 / 9, 40, 405);
    expect(b.w).toBe(Math.round((340 - 40) / (16 / 9)));
    expect(b.y).toBe(60);
  });
});

describe('readBox', () => {
  it('reads a kept box and refuses anything else', () => {
    expect(readBox('{"x":1,"y":2,"w":300}')).toEqual({ x: 1, y: 2, w: 300 });
    expect(readBox('')).toBeNull();
    expect(readBox('{"x":1}')).toBeNull();
    expect(readBox('nope')).toBeNull();
  });
});
