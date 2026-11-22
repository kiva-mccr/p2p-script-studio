import { describe, expect, it } from 'vitest';
import { held, percent, zone } from '../../src/lib/levelmeter';

describe('the live level (AU-11)', () => {
  it('places a level on the bar, from -60 dBFS to 0', () => {
    expect(percent(-60)).toBe(0);
    expect(percent(-30)).toBe(50);
    expect(percent(0)).toBe(100);
    expect(percent(-Infinity)).toBe(0);
    expect(percent(3)).toBe(100);
  });

  it('says too quiet, good or too loud', () => {
    expect(zone(-40)).toBe('quiet');
    expect(zone(-18)).toBe('good');
    expect(zone(-2)).toBe('loud');
  });

  it('holds the loudest moment for a second', () => {
    let peak = held({ db: -Infinity, at: 0 }, -10, 0);
    peak = held(peak, -20, 500);
    expect(peak.db).toBe(-10);
    peak = held(peak, -20, 1200);
    expect(peak.db).toBe(-20);
  });
});
