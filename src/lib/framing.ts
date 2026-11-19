// Your own frame rate and size (#217, board 86), for the Resolve / Premiere and the video exports: the typed values
// read and checked, NTSC rates (23.976, 29.97, 59.94…) recognised, and a size's shape named ("4:5").

// The typed values, kept as typed (strings) so a half-typed box isn't overwritten; remembered with the settings.
export type Own = { ownFps: string; ownWidth: string; ownHeight: string };
export const OWN: Own = { ownFps: '23.976', ownWidth: '1080', ownHeight: '1350' };
export const FPS_RANGE = [1, 120] as const;
export const SIDE_RANGE = [16, 8192] as const;

// A frame rate from 1 to 120, decimals allowed (a comma too), or null.
export function readFps(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= FPS_RANGE[0] && n <= FPS_RANGE[1] ? n : null;
}

// A width or height in whole pixels, 16 to 8192, or null.
export function readSide(text: string): number | null {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= SIDE_RANGE[0] && n <= SIDE_RANGE[1] ? n : null;
}

// How a rate is counted. NTSC rates (a whole number × 1000/1001, typed as 23.976 or 29.97) are that whole number with
// `ntsc`, counted at exactly N × 1000/1001. Any other decimal (12.5) can't be said in Final Cut Pro 7 XML, which
// counts whole frames, so `timebase` rounds it (`rounded`); `exact` is still the typed rate, for the video.
export function frameRate(fps: number): { timebase: number; ntsc: boolean; perSecond: number; exact: number; rounded: boolean } {
  const whole = Math.round(fps);
  if (Math.abs(fps - whole) < 1e-6) return { timebase: whole, ntsc: false, perSecond: whole, exact: whole, rounded: false };
  const n = Math.round(fps * 1.001);
  const ntsc = (n * 1000) / 1001;
  if (Math.abs(fps - ntsc) < 0.005) return { timebase: n, ntsc: true, perSecond: ntsc, exact: ntsc, rounded: false };
  const base = Math.max(1, whole);
  return { timebase: base, ntsc: false, perSecond: base, exact: fps, rounded: true };
}

// A size's shape: "16:9", "4:5", or "1.78:1" when the plain ratio would be long (1366 × 768).
export function shapeName(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const d = gcd(width, height);
  const [w, h] = [width / d, height / d];
  return w <= 32 && h <= 32 ? `${w}:${h}` : `${Math.round((width / height) * 100) / 100}:1`;
}
