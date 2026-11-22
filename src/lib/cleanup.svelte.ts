// Clean-up for voice-over takes (AU-4, board 31): crop the silence at a take's start and end, and even out the
// loudness (AU-11, board 97): every take as loud as the next, and the end of a take as loud as its start. The recording is kept whole: `measure` finds where the speech is and how loud, the take's JSON keeps
// that, and `span` applies it when a take is played, joined or timed. The switches live in Settings, in this browser.
import { keep, recall } from './remember';

// Where to cut (seconds into the recording) and how much louder to play it. ride (AU-11): a gain on top of `gain`
// every RIDE seconds from the recording's start (each value at the middle of its step), so a take that fades is
// brought back up; takes measured before AU-11 have none.
export type Measure = { from: number; to: number; gain: number; ride?: number[] };

const KEY = 'voice-cleanup';
const PAD = 0.25; // seconds kept either side of the speech, so words never start abruptly
const FRAME = 0.01; // seconds per loudness reading
const JOIN = 0.25; // gaps shorter than this are inside the speech
const SOUND = 0.15; // a sound shorter than this on its own (a mouse click, a breath) isn't speech
const TARGET = -16; // the speech's loudness to aim for, in LUFS (spoken word online)
const CEILING = 0.89; // the loudest sample never goes past this (-1 dBFS)
export const RIDE = 0.5; // seconds per step of the ride
const RIDE_WINDOW = 1; // seconds of speech either side of a step that set its level, so it follows slowly
const RIDE_MAX = 6; // dB the ride may raise or lower a part of a take (2x)

// crop and level are applied when played, so they change every measured take at once; noise is Chrome's own noise
// reduction while recording, so it only changes takes recorded after.
export const cleaning = $state(load());

function load(): { crop: boolean; noise: boolean; level: boolean } {
  const on = { crop: true, noise: true, level: true };
  try {
    return { ...on, ...JSON.parse(recall(KEY) || '{}') };
  } catch {
    return on;
  }
}

export function setCleaning(change: Partial<typeof cleaning>): void {
  Object.assign(cleaning, change);
  keep(KEY, JSON.stringify(cleaning));
}

// Where the speech is in a recording (mono samples at `rate`) and how loud it is. null when nothing is heard.
export function measure(samples: Float32Array, rate: number): Measure | null {
  const size = Math.max(1, Math.round(rate * FRAME));
  const levels: number[] = [];
  for (let at = 0; at + size <= samples.length; at += size) {
    let sum = 0;
    for (let i = at; i < at + size; i++) sum += samples[i] * samples[i];
    levels.push(Math.sqrt(sum / size));
  }
  if (!levels.length) return null;
  const peak = Math.max(...levels);
  if (peak < 0.001) return null; // silence (about -60 dBFS)
  // "Loud" is measured against the voice, not the peak (a click can be the peak) or only the room's noise (which sat
  // just under it, so breaths and rustles counted as speech and nothing was cut): a tenth of the voice's level
  // (-20 dB), and well over the quietest tenth.
  const sorted = [...levels].sort((a, b) => a - b);
  const floor = sorted[Math.floor(levels.length / 10)];
  const voice = sorted[Math.floor(levels.length * 0.95)];
  const loud = Math.max(floor * 4, voice * 0.1, 0.001);
  // Runs of loud frames, joined across short gaps; the speech is from the first long one to the last.
  const runs: [number, number][] = [];
  levels.forEach((level, i) => {
    if (level < loud) return;
    const last = runs.at(-1);
    if (last && (i - last[1]) * FRAME <= JOIN) last[1] = i + 1;
    else runs.push([i, i + 1]);
  });
  const speech = runs.filter(([a, b]) => (b - a) * FRAME >= SOUND);
  if (!speech.length) return null;
  const first = speech[0][0];
  const last = speech.at(-1)![1];
  const length = samples.length / rate;
  // The speech's loudness as ears hear it (K-weighted, ITU-R BS.1770), every frame.
  const heard = weighted(samples, rate);
  const power: number[] = levels.map((_, i) => {
    let sum = 0;
    for (let k = i * size; k < (i + 1) * size; k++) sum += heard[k] * heard[k];
    return sum / size;
  });
  const isSpeech = (i: number) => i >= first && i < last && levels[i] >= loud;
  const whole = lufs(power, isSpeech, 0, levels.length);
  if (whole === null) return null;
  // The ride: each step's loudness from the speech within RIDE_WINDOW of it, against the whole take's, so quieter
  // parts come up and louder ones go down, at most RIDE_MAX dB. A step with no speech near it (a pause) holds the
  // level of the speech before it, so pauses are never raised on their own.
  const per = Math.round(RIDE / FRAME);
  const reach = Math.round(RIDE_WINDOW / FRAME);
  const steps = Math.ceil(levels.length / per);
  const db: (number | null)[] = [];
  for (let s = 0; s < steps; s++) {
    const mid = s * per + per / 2;
    const near = lufs(power, isSpeech, Math.max(0, Math.round(mid - reach)), Math.min(levels.length, Math.round(mid + reach)));
    db.push(near === null ? null : Math.max(-RIDE_MAX, Math.min(RIDE_MAX, whole - near)));
  }
  const held = hold(db);
  // Smoothed over three steps, so the level glides rather than steps.
  const ride = held.map((_, s) => {
    const around = held.slice(Math.max(0, s - 1), s + 2);
    return round(10 ** (around.reduce((a, b) => a + b, 0) / around.length / 20), 100);
  });
  // The gain that brings the speech to TARGET, never pushing a sample (with the ride) past CEILING.
  let top = 0;
  for (let i = first * size; i < Math.min(samples.length, last * size); i++)
    top = Math.max(top, Math.abs(samples[i]) * rideAt(ride, i / rate));
  const gain = Math.min(10 ** ((TARGET - whole) / 20), CEILING / top, 8);
  return {
    from: round(Math.max(0, first * FRAME - PAD), 100),
    to: round(Math.min(length, last * FRAME + PAD), 100),
    gain: round(Math.max(0.25, gain), 100),
    ride,
  };
}

// The ride's gain at `t` seconds into the recording: its values joined by straight lines, the ends held. 1 with none.
export function rideAt(ride: number[] | null | undefined, t: number): number {
  if (!ride?.length) return 1;
  const at = t / RIDE - 0.5;
  if (at <= 0) return ride[0];
  if (at >= ride.length - 1) return ride[ride.length - 1];
  const i = Math.floor(at);
  return ride[i] + (ride[i + 1] - ride[i]) * (at - i);
}

// Gated loudness (LUFS) of the speech frames between `from` and `to`, as BS.1770 does it: 400 ms blocks every 100 ms,
// leaving out blocks under -70 LUFS, then those 10 LU under the rest. Only speech frames count, so pauses don't
// pull it down. null when there's no speech there.
function lufs(power: number[], isSpeech: (i: number) => boolean, from: number, to: number): number | null {
  const BLOCK = Math.round(0.4 / FRAME);
  const HOP = Math.round(0.1 / FRAME);
  const blocks: number[] = [];
  for (let at = from; at < to; at += HOP) {
    let sum = 0;
    let n = 0;
    for (let i = at; i < Math.min(to, at + BLOCK); i++) if (isSpeech(i)) (sum += power[i]), n++;
    if (n >= BLOCK / 4) blocks.push(sum / n);
  }
  const loudness = (p: number) => -0.691 + 10 * Math.log10(p);
  const kept = blocks.filter((p) => p > 0 && loudness(p) > -70);
  if (!kept.length) return null;
  const gate = loudness(kept.reduce((a, b) => a + b, 0) / kept.length) - 10;
  const louder = kept.filter((p) => loudness(p) > gate);
  return loudness(louder.reduce((a, b) => a + b, 0) / louder.length);
}

// Steps with no speech near them take the level of the one before (or, at the start, the first after).
function hold(db: (number | null)[]): number[] {
  const firstKnown = db.find((d) => d !== null) ?? 0;
  let last = firstKnown;
  return db.map((d) => (d === null ? last : (last = d)));
}

// The samples through BS.1770's K-weighting: a shelf that lifts the highs the way a head does, then a high-pass
// that drops the rumble. Its filters are worked out for any sample rate.
function weighted(samples: Float32Array, rate: number): Float32Array {
  const shelf = (() => {
    const K = Math.tan((Math.PI * 1681.974450955533) / rate);
    const Q = 0.7071752369554196;
    const Vh = 10 ** (3.999843853973347 / 20);
    const Vb = Vh ** 0.4996667741545416;
    const a0 = 1 + K / Q + K * K;
    return [(Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  })();
  const highPass = (() => {
    const K = Math.tan((Math.PI * 38.13547087602444) / rate);
    const Q = 0.5003270373238773;
    const a0 = 1 + K / Q + K * K;
    return [1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0];
  })();
  return biquad(biquad(samples, shelf), highPass);
}

function biquad(x: Float32Array, [b0, b1, b2, a1, a2]: number[]): Float32Array {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const out = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1, x1 = x[i], y2 = y1, y1 = out;
    y[i] = out;
  }
  return y;
}

// What to play of a take, as set in Settings: the whole recording (`seconds` long, as timed) or its measured part.
// to is null for "to the end".
export function span(take: { seconds: number } & Partial<Measure>, how = cleaning) {
  const cropped = how.crop && take.to !== undefined && take.from !== undefined;
  const from = cropped ? take.from! : 0;
  const to = cropped ? take.to! : null;
  return {
    from,
    to,
    gain: how.level && take.gain ? take.gain : 1,
    ride: how.level && take.ride?.length ? take.ride : null,
    seconds: cropped ? round(to! - from, 10) : take.seconds,
    cut: cropped ? Math.max(0, round(take.seconds - (to! - from), 10)) : 0,
  };
}

const round = (n: number, by: number) => Math.round(n * by) / by;
