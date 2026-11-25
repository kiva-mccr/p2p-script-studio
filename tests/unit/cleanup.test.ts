import { describe, expect, it } from 'vitest';
import { measure, rideAt, span } from '../../src/lib/cleanup.svelte';
import { cleaned } from '../../src/lib/voiceexport';
import { plan } from '../../src/lib/play.svelte';
import { wpm } from '../../src/lib/voice.svelte';
import type { Script } from '../../src/lib/script';

const RATE = 8000;

// A recording made of parts: [seconds, loudness] (0 is silence, with a little hiss), as a tone.
function sound(parts: [number, number][]): Float32Array {
  const out: number[] = [];
  for (const [seconds, level] of parts)
    for (let i = 0; i < seconds * RATE; i++) out.push(level * Math.sin(i / 3) + (Math.random() - 0.5) * 0.0004);
  return Float32Array.from(out);
}

describe('measure', () => {
  it('finds the speech, keeping a quarter second either side', () => {
    const m = measure(sound([[1, 0], [2, 0.3], [1.5, 0]]), RATE)!;
    expect(m.from).toBeCloseTo(0.75, 1);
    expect(m.to).toBeCloseTo(3.25, 1);
  });

  it('keeps pauses in the middle and never cuts past the ends', () => {
    const m = measure(sound([[0.1, 0], [1, 0.3], [1.2, 0], [1, 0.3], [0.1, 0]]), RATE)!;
    expect(m.from).toBe(0);
    expect(m.to).toBeCloseTo(3.4, 1);
  });

  it('drops a mouse click at the end', () => {
    const m = measure(sound([[0.5, 0], [1, 0.3], [1, 0], [0.02, 0.6], [0.3, 0]]), RATE)!;
    expect(m.to).toBeCloseTo(1.75, 1);
  });

  it('makes a quiet take louder and a loud one quieter, without clipping', () => {
    const quiet = measure(sound([[0.5, 0], [1, 0.02], [0.5, 0]]), RATE)!;
    const loud = measure(sound([[0.5, 0], [1, 0.8], [0.5, 0]]), RATE)!;
    expect(quiet.gain).toBeGreaterThan(1);
    expect(loud.gain).toBeLessThan(1);
    expect(quiet.gain * 0.02).toBeLessThanOrEqual(0.9);
  });

  it('crops in a noisy room: hum, hiss, a breath and rustles before the first word are not speech', () => {
    // Hiss plus a steady 60 Hz hum, as from a fridge or a computer.
    const noisy = (parts: [number, number][]) => sound(parts).map((v, i) => v + (Math.random() - 0.5) * 0.03 + 0.03 * Math.sin((2 * Math.PI * 60 * i) / RATE));
    const m = measure(noisy([[0.6, 0], [0.12, 0.05], [0.5, 0], [0.3, 0.02], [0.4, 0], [1.5, 0.3], [0.8, 0], [0.1, 0.04], [0.4, 0]]), RATE)!;
    expect(m.from).toBeCloseTo(1.65, 1);
    expect(m.to).toBeCloseTo(3.65, 1);
  });

  it('aims the speech at -16 LUFS: a take measured louder or quieter lands at the same loudness', () => {
    const quiet = measure(sound([[0.5, 0], [3, 0.05], [0.5, 0]]), RATE)!;
    const loud = measure(sound([[0.5, 0], [3, 0.2], [0.5, 0]]), RATE)!;
    expect(quiet.gain * 0.05).toBeCloseTo(loud.gain * 0.2, 2);
  });

  it('evens out a take that starts loud and fades (AU-11)', () => {
    // Three seconds loud, three quieter, three quieter still (to a quarter), with pauses between.
    const m = measure(sound([[0.3, 0], [3, 0.4], [0.3, 0], [3, 0.2], [0.3, 0], [3, 0.1], [0.3, 0]]), RATE)!;
    const at = (t: number) => rideAt(m.ride, t);
    expect(at(1.5)).toBeLessThan(1); // the loud start comes down
    expect(at(8.4)).toBeGreaterThan(1.5); // the faded end comes up
    // Played with its ride, the start and end are within 3 dB of each other (they were 12 dB apart).
    expect(Math.abs(20 * Math.log10((0.4 * at(1.5)) / (0.1 * at(8.4))))).toBeLessThan(3);
  });

  it('raises or lowers a part at most 2x, and holds through a pause', () => {
    const m = measure(sound([[0.3, 0], [3, 0.5], [2, 0], [3, 0.02], [0.3, 0]]), RATE)!;
    expect(Math.max(...m.ride!)).toBeLessThanOrEqual(2);
    expect(Math.min(...m.ride!)).toBeGreaterThanOrEqual(0.5);
    // The middle of the pause holds the level of the speech before it, not a boost of its own.
    expect(rideAt(m.ride, 4.3)).toBeLessThanOrEqual(rideAt(m.ride, 2) + 0.05);
  });

  it('never pushes a sample past -1 dBFS with the ride', () => {
    const samples = sound([[0.3, 0], [2, 0.6], [2, 0.15], [0.3, 0]]);
    const m = measure(samples, RATE)!;
    let top = 0;
    samples.forEach((v, i) => (top = Math.max(top, Math.abs(v) * m.gain * rideAt(m.ride, i / RATE))));
    expect(top).toBeLessThanOrEqual(0.9);
  });

  it('finds nothing in silence', () => {
    expect(measure(sound([[1, 0]]), RATE)).toBeNull();
    expect(measure(new Float32Array(0), RATE)).toBeNull();
  });
});

describe('span', () => {
  const take = { seconds: 5, from: 1, to: 3.5, gain: 2 };
  const all = { crop: true, noise: true, level: true };

  it('plays the measured part at its gain', () => {
    expect(span(take, all)).toEqual({ from: 1, to: 3.5, gain: 2, ride: null, seconds: 2.5, cut: 2.5 });
    expect(span({ ...take, ride: [1, 2] }, all).ride).toEqual([1, 2]);
    expect(span({ ...take, ride: [1, 2] }, { ...all, level: false }).ride).toBeNull();
  });

  it('plays the whole take with the switches off, or a take that was never measured', () => {
    expect(span(take, { ...all, crop: false, level: false })).toEqual({ from: 0, to: null, gain: 1, ride: null, seconds: 5, cut: 0 });
    expect(span({ seconds: 5 }, all)).toEqual({ from: 0, to: null, gain: 1, ride: null, seconds: 5, cut: 0 });
  });

  it('times the take, its words a minute and Play the script by the cropped part', () => {
    const t = { by: 'Sam', at: 0, seconds: 6, text: 'one two three four five', from: 0.5, to: 2.5, gain: 1 };
    expect(wpm(t, '')).toBe(150); // 5 words in 2 s
    const script: Script = { front: null, intro: '', blocks: [{ type: 'row', speaker: '', id: 'a', dialogue: 'one two three four five', onScreen: '', files: [], timeline: '', note: '' }] };
    expect(plan(script, { a: t }, 150)[0].seconds).toBe(2);
  });
});

describe('cleaned', () => {
  it('cuts the samples and applies the gain, as the joined WAV does', () => {
    const samples = Float32Array.from({ length: 40 }, () => 0.1);
    const out = cleaned(samples, { seconds: 4, from: 1, to: 3, gain: 2 }, 10);
    expect(out.length).toBe(20);
    expect(out[0]).toBeCloseTo(0.2);
  });

  it('follows the ride (AU-11): the end of a faded take comes up as Play plays it', () => {
    const samples = Float32Array.from({ length: 40 }, () => 0.1);
    // At 10 samples a second: the ride is 1 for the first second, then 2.
    const out = cleaned(samples, { seconds: 4, from: 0, to: 4, gain: 1, ride: [1, 1, 2, 2, 2, 2, 2, 2] }, 10);
    expect(out[0]).toBeCloseTo(0.1);
    expect(out[30]).toBeCloseTo(0.2);
  });
});
