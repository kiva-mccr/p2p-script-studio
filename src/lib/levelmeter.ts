// The live level while recording (AU-11, board 97): where the mic's level sits on the bar, and which zone that is.
export const FLOOR = -60; // dBFS at the bar's left end
export const QUIET = -30; // under this the voice is too quiet (grey)
export const LOUD = -6; // over this it is close to clipping (red)
export const HOLD = 1000; // ms the tick holds the loudest moment

// Percent along the bar for a level in dBFS.
export const percent = (db: number): number => Math.max(0, Math.min(100, ((db - FLOOR) / -FLOOR) * 100));

export const zone = (db: number): 'quiet' | 'good' | 'loud' => (db < QUIET ? 'quiet' : db > LOUD ? 'loud' : 'good');

// The tick: the loudest level in the last HOLD ms. `peak` is the one held and when it was set.
export function held(peak: { db: number; at: number }, db: number, now: number): { db: number; at: number } {
  return db >= peak.db || now - peak.at > HOLD ? { db, at: now } : peak;
}
