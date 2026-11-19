import { describe, expect, it } from 'vitest';
import { frameRate, readFps, readSide, shapeName } from '../../src/lib/framing';

describe('your own frame rate and size (#217)', () => {
  it('reads a rate from 1 to 120, decimals allowed', () => {
    expect(readFps('23.976')).toBe(23.976);
    expect(readFps(' 25 ')).toBe(25);
    expect(readFps('29,97')).toBe(29.97);
    expect(readFps('120')).toBe(120);
    for (const bad of ['', '0', '0.5', '121', 'fast', '24fps', '-24', '1e2']) expect(readFps(bad)).toBeNull();
  });

  it('reads a side in whole pixels, 16 to 8192', () => {
    expect(readSide('1080')).toBe(1080);
    for (const bad of ['', '15', '8193', '10.5', 'wide']) expect(readSide(bad)).toBeNull();
  });

  it('counts NTSC rates at N × 1000/1001, others as they are or rounded to whole frames', () => {
    expect(frameRate(30)).toMatchObject({ timebase: 30, ntsc: false, rounded: false });
    expect(frameRate(29.97)).toMatchObject({ timebase: 30, ntsc: true, perSecond: 30000 / 1001 });
    expect(frameRate(23.976)).toMatchObject({ timebase: 24, ntsc: true, exact: 24000 / 1001 });
    expect(frameRate(59.94)).toMatchObject({ timebase: 60, ntsc: true });
    expect(frameRate(12.5)).toMatchObject({ timebase: 13, ntsc: false, exact: 12.5, rounded: true });
  });

  it('names a shape', () => {
    expect(shapeName(1080, 1350)).toBe('4:5');
    expect(shapeName(1920, 1080)).toBe('16:9');
    expect(shapeName(1080, 1080)).toBe('1:1');
    expect(shapeName(1366, 768)).toBe('1.78:1');
  });
});
