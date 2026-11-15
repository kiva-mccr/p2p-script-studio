// The one Undo toast (UX-1, board 72): an action says what it did and how to take it back; the toast offers Undo for
// 10 seconds, and a newer action replaces it. No browser dialogs anywhere (the user's rule): Undo instead.
export type Offer = {
  what: string; // "Take of row 1 deleted."
  label?: string; // the button, when "Undo" alone isn't clear ("Undo, keep the old take")
  back: () => void | Promise<void>;
};

export class Undo {
  shown = $state<Offer | null>(null);
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(readonly ms = 10000) {}

  offer(offer: Offer) {
    this.shown = offer;
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => (this.shown = null), this.ms);
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
