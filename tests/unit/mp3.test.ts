import { describe, expect, it } from 'vitest';
import { encodeMp3, KBPS } from '../../src/lib/mp3';

const tone = (seconds: number, rate = 48000) => Float32Array.from({ length: seconds * rate }, (_, i) => 0.5 * Math.sin(i / 10));

describe('encodeMp3 (#237)', () => {
  it('makes MPEG-1 layer III frames at 48 kHz and 128 kbps, with the gap between takes', async () => {
    const bytes = new Uint8Array(await encodeMp3([tone(1), tone(1)], 48000, 0.5).arrayBuffer());
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1] & 0xfe).toBe(0xfa); // frame sync, MPEG-1, layer III
    expect(bytes[2] >> 4).toBe(9); // 128 kbps
    expect((bytes[2] >> 2) & 3).toBe(1); // 48 kHz
    // 2.5 s at 128 kbps is 40,000 bytes; LAME adds a frame or two at the ends.
    expect(bytes.length).toBeGreaterThan(39000);
    expect(bytes.length).toBeLessThan(42000);
    expect(KBPS).toBe(128);
  });

  it('is about a tenth the size of the 16-bit WAV', async () => {
    const mp3 = (await encodeMp3([tone(3)], 48000, 0)).size;
    expect(mp3 / (3 * 48000 * 2)).toBeLessThan(0.2);
  });
});
