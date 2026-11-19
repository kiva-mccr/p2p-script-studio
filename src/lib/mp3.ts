// The voice-over as an .mp3 (#237, board 86): the lined-up takes, one after another with `gap` seconds between, encoded
// by LAME (lamejs, shipped with the app, so nothing leaves the computer). Run in mp3.worker.ts; tests call it directly.
import { Mp3Encoder } from '@breezystack/lamejs';

export const KBPS = 128;
// LAME takes 1152 samples a frame; this many frames go in at once.
const CHUNK = 1152 * 32;

export function encodeMp3(clips: Float32Array[], rate: number, gap: number): Blob {
  const encoder = new Mp3Encoder(1, rate, KBPS);
  const parts: BlobPart[] = [];
  const add = (bytes: Uint8Array) => bytes.length && parts.push(new Uint8Array(bytes));
  const pause = new Int16Array(Math.round(gap * rate));
  for (const [i, samples] of clips.entries()) {
    if (i && pause.length) for (let at = 0; at < pause.length; at += CHUNK) add(encoder.encodeBuffer(pause.subarray(at, at + CHUNK)));
    for (let at = 0; at < samples.length; at += CHUNK) add(encoder.encodeBuffer(pcm16(samples.subarray(at, at + CHUNK))));
  }
  add(encoder.flush());
  return new Blob(parts, { type: 'audio/mpeg' });
}

function pcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}
