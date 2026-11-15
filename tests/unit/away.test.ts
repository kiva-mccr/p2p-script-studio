import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Away } from '../../src/lib/away';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('away after the wait with no touch; the first touch back calls onBack once', () => {
  const back = vi.fn();
  const away = new Away(back, () => false, 1000);
  expect(away.away).toBe(false);
  vi.advanceTimersByTime(900);
  away.touch();
  vi.advanceTimersByTime(900);
  expect(away.away).toBe(false);
  expect(back).not.toHaveBeenCalled();
  vi.advanceTimersByTime(200);
  expect(away.away).toBe(true);
  away.touch();
  away.touch();
  expect(away.away).toBe(false);
  expect(back).toHaveBeenCalledTimes(1);
});

test('something playing is never away', () => {
  let playing = true;
  const away = new Away(() => {}, () => playing, 1000);
  vi.advanceTimersByTime(5000);
  expect(away.away).toBe(false);
  playing = false;
  vi.advanceTimersByTime(900);
  expect(away.away).toBe(false); // counted from when it stopped
  vi.advanceTimersByTime(200);
  expect(away.away).toBe(true);
});
