// Each tab keeps where you were in it (UX-3, board 72): back to Write lands where you left it, not at the top.
// A tab comes back taller for a moment (its rows and pictures settle after it shows), so the place is held until the
// page's height stops changing; anything you do, or a jump by the app (`stop`), lets go of it at once.
const LET_GO = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;

export class Places {
  #at: Record<string, number> = {};
  #frame = 0;
  #letGo = () => this.stop();

  // Every scroll of the window; not while a place is being held, whose scrolls are the app's own.
  note(tab: string, y: number) {
    if (!this.#frame) this.#at[tab] = y;
  }

  // Goes to the tab's place: the top the first time.
  go(tab: string) {
    this.stop();
    const y = this.#at[tab] ?? 0;
    let height = -1, still = 0, frames = 0;
    const hold = () => {
      const now = document.documentElement.scrollHeight;
      // Moved while the height stood still: not the tab settling but someone scrolling (the app, a script): let go.
      if (scrollY !== y && now === height) return this.stop();
      if (scrollY !== y) scrollTo(0, y);
      still = now === height ? still + 1 : 0;
      height = now;
      if (still >= 10 || ++frames > 120) return this.stop(); // settled, or two seconds at most
      this.#frame = requestAnimationFrame(hold);
    };
    this.#frame = requestAnimationFrame(hold);
    scrollTo(0, y);
    for (const e of LET_GO) addEventListener(e, this.#letGo, { capture: true, passive: true });
  }

  stop() {
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    for (const e of LET_GO) removeEventListener(e, this.#letGo, { capture: true });
  }
}
