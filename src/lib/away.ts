// Away (PF-14): no mouse, key, scroll or touch in this tab for 2 minutes, and nothing playing. The Editor then stops
// its 5 s check and its "… is editing" file, so an away computer makes no folder calls; the first touch after that
// calls `onBack` to catch up. No timer: being away is worked out when asked.

/** Away after this long without a touch. Tests shorten it (`away-after` in this browser's storage). */
export const AWAY_AFTER = (() => {
  try {
    return Number(localStorage.getItem('away-after')) || 2 * 60 * 1000;
  } catch {
    return 2 * 60 * 1000;
  }
})();

const EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

export class Away {
  #last = Date.now();

  // busy: something that goes on without a touch (playing, recording, the teleprompter), which isn't away.
  constructor(private onBack: () => void, private busy: () => boolean = () => false, private after = AWAY_AFTER) {}

  /** True once nothing has happened for `after`; being busy counts as something happening. */
  get away(): boolean {
    if (this.busy()) this.#last = Date.now();
    return Date.now() - this.#last > this.after;
  }

  /** A touch (or coming back to the tab): back from away calls `onBack` once. */
  touch = () => {
    const back = this.away;
    this.#last = Date.now();
    if (back) this.onBack();
  };

  /** Listens on the page; returns the stop. */
  listen(): () => void {
    const opts = { capture: true, passive: true };
    for (const e of EVENTS) window.addEventListener(e, this.touch, opts);
    return () => EVENTS.forEach((e) => window.removeEventListener(e, this.touch, opts));
  }
}
