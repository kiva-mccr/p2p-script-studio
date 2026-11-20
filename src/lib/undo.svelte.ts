// The one Undo toast (UX-1, board 72): an action says what it did and how to take it back; the toast offers Undo for
// 5 seconds, or until the person carries on working, and a newer action replaces it. No browser dialogs anywhere (the
// user's rule): Undo instead.
export type Offer = {
  what: string; // "Take of row 1 deleted."
  name?: string; // a file's or a person's name it starts with, covered in Feedback's picture ("leaf.jpg" removed from row 2.)
  label?: string; // the button, when "Undo" alone isn't clear ("Undo, keep the old take")
  back: () => void | Promise<void>;
  // Doing it again (Ctrl+Y), for a change outside the script's text (a take): with it, it is also a Ctrl+Z step
  // (lib/steps.ts). `row`: the row it was on, scrolled to when undone with Ctrl+Z.
  again?: () => Promise<unknown>;
  row?: string;
};

/** How long the toast stays. Tests lengthen it (`undo-for` in this browser's storage), so a slow save can't hide it. */
export function undoFor() {
  try {
    return Number(localStorage.getItem('undo-for')) || 5000;
  } catch {
    return 5000;
  }
}

// Keys that don't count as carrying on: Tab and a lone modifier, so Undo can still be reached by keyboard.
const reaching = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

export class Undo {
  shown = $state<Offer | null>(null);
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(readonly ms = undoFor()) {}

  offer(offer: Offer) {
    this.shown = offer;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.shown = null), this.ms);
  }

  // A key or a click anywhere but the toast (marked `data-undo`) means the person carried on: the toast goes. Called
  // on the window in the capture phase, so the step that offers a new Undo runs after this and is shown.
  carryOn(e: { key?: string; target: EventTarget | null }) {
    if (!this.shown || (e.key !== undefined && reaching.has(e.key))) return;
    if ((e.target as Element | null)?.closest?.('[data-undo]')) return;
    this.clear();
  }

  // Undo pressed: the toast goes at once, then the action is taken back.
  async take() {
    const offer = this.shown;
    this.clear();
    await offer?.back();
  }

  clear() {
    clearTimeout(this.#timer);
    this.shown = null;
  }
}
