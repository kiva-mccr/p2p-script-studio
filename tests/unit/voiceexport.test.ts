import { describe, expect, it } from 'vitest';
import { lineUp, wav, wavFile } from '../../src/lib/voiceexport';

describe('wavFile', () => {
  const clips = [{ row: 1, samples: new Float32Array([0.1, 0.2]) }, { row: 3, samples: new Float32Array([0.3]) }];
  const samples = async (gap: number) => {
    const view = new DataView(await (await wavFile(clips, 4, gap))!.arrayBuffer());
    return Array.from({ length: (view.byteLength - 44) / 2 }, (_, i) => +(view.getInt16(44 + i * 2, true) / 0x7fff).toFixed(1));
  };
  it('puts the clips one after another', async () => {
    expect(await samples(0)).toEqual([0.1, 0.2, 0.3]);
  });
  it('leaves a silence between clips, not after the last', async () => {
    expect(await samples(0.5)).toEqual([0.1, 0.2, 0, 0, 0.3]);
  });
  it('is the same WAV as the takes joined in one go, made in slices', async () => {
    const long = [{ row: 1, samples: Float32Array.from({ length: 3_000_000 }, (_, i) => Math.sin(i / 7)) }, { row: 2, samples: new Float32Array(10).fill(0.5) }];
    const all = new Float32Array(3_000_010);
    all.set(long[0].samples);
    all.set(long[1].samples, 3_000_000);
    expect(new Uint8Array(await (await wavFile(long, 48000, 0))!.arrayBuffer())).toEqual(wav(all, 48000));
  });
  it('stops, giving nothing, once the settings changed', async () => {
    const long = [{ row: 1, samples: new Float32Array(3_000_000) }];
    expect(await wavFile(long, 48000, 0, () => true)).toBeNull();
  });
});

describe('lineUp', () => {
  const clips = [{ row: 2, samples: new Float32Array([0.5]) }];
  it('leaves rows with no take out, unless asked for silence', () => {
    expect(lineUp(clips, [1, 9, 0.5, 0], 2, false)).toBe(clips);
    const lined = lineUp(clips, [1, 9, 0.5, 0], 2, true);
    expect(lined.map((c) => [c.row, c.samples.length, !!c.silent])).toEqual([[1, 2, true], [2, 1, false], [3, 1, true]]);
  });
});

describe('wav', () => {
  it('is a mono 16-bit WAV at the rate, clipped to full scale', () => {
    const bytes = wav(new Float32Array([0, 1, -1, 2]), 48000);
    const view = new DataView(bytes.buffer);
    expect(String.fromCharCode(...bytes.subarray(0, 4), ...bytes.subarray(8, 12))).toBe('RIFFWAVE');
    expect([view.getUint16(22, true), view.getUint32(24, true), view.getUint16(34, true), view.getUint32(40, true)]).toEqual([1, 48000, 16, 8]);
    expect([0, 1, 2, 3].map((i) => view.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767]);
  });
});
