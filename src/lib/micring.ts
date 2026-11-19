// The ring round the mic on the script list (#241, board 90): one slice per row in script order, clockwise from 12
// o'clock, sized by the row's words; recorded rows filled, a row still to record a gap of at least MIN_GAP.

// `voice`, one number per row in script order: the row's dialogue words (at least 1) when it has a take, minus them
// when it has none, 0 when it needs none (no dialogue, no take).
export type Voice = number[];

export const MIN_GAP = 0.08; // a missing row's gap is at least this share of the ring, so one short row still shows

export type Ring = {
  arcs: [number, number][]; // the recorded runs, as shares of the ring from 12 o'clock (0 to 1)
  done: number; // rows recorded
  of: number; // rows that need a take
  missing: number[]; // row numbers (from 1) still to record
};

// The ring for a script's rows, or null when no row has a take yet (no ring then).
export function micRing(voice: Voice): Ring | null {
  const needed = voice.map((v, i) => ({ v, row: i + 1 })).filter((r) => r.v !== 0);
  const done = needed.filter((r) => r.v > 0).length;
  if (!done) return null;
  const total = needed.reduce((t, r) => t + Math.abs(r.v), 0);
  let parts = needed.map((r) => (r.v > 0 ? r.v / total : Math.max(-r.v / total, MIN_GAP)));
  const gaps = parts.reduce((t, p, i) => t + (needed[i].v < 0 ? p : 0), 0);
  const recorded = parts.reduce((t, p, i) => t + (needed[i].v > 0 ? p : 0), 0);
  // The recorded rows share what the gaps leave, so every gap keeps its full size (unless the gaps fill the ring).
  if (gaps < 1) parts = parts.map((p, i) => (needed[i].v > 0 ? (p * (1 - gaps)) / recorded : p));
  const sum = parts.reduce((a, b) => a + b, 0);
  const arcs: [number, number][] = [];
  let at = 0;
  needed.forEach((r, i) => {
    const from = at;
    at += parts[i] / sum;
    if (r.v < 0) return;
    const last = arcs.at(-1);
    if (last && Math.abs(last[1] - from) < 1e-9) last[1] = at;
    else arcs.push([from, at]);
  });
  return { arcs, done, of: needed.length, missing: needed.filter((r) => r.v < 0).map((r) => r.row) };
}

// What the ring says on hover and to a screen reader.
export function ringLabel(ring: Ring): string {
  if (!ring.missing.length) return 'recorded';
  const rows = ring.missing.length > 6 ? `${ring.missing.slice(0, 6).join(', ')}…` : ring.missing.join(', ');
  return `${ring.done} of ${ring.of} rows recorded · missing: row ${rows}`;
}
