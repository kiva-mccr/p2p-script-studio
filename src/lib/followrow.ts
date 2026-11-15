// While the script plays (AU-2) the page follows the row being played, until you scroll it yourself (UX-12, board 74).
// "Yourself" is read from what you do (the wheel, a touch, scroll keys, the scroll bar), not from scroll events,
// which the app's own smooth scrolling fires too.
import type { Player } from './play.svelte';

// Brings a row into view, only when it isn't all in view under the top bar.
export function bring(el: Element) {
  const { top, bottom } = el.getBoundingClientRect();
  const ceiling = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 0;
  if (top >= ceiling + 40 && bottom <= innerHeight) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

const KEYS = new Set(['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' ']);

// Stops the following when you scroll the page; returns the clean-up.
export function watchScroll(player: Player): () => void {
  const stop = () => {
    if (player.started) player.following = false;
  };
  const key = (e: KeyboardEvent) => {
    const typing = (e.target as HTMLElement).closest?.('input, textarea, select, [contenteditable], button');
    if (!typing && KEYS.has(e.key) && e.key !== ' ') stop(); // Space pauses the script (Editor)
  };
  // A press on the page's scroll bar lands on the page itself, right of its content.
  const bar = (e: PointerEvent) => {
    if (e.target === document.documentElement && e.clientX >= document.documentElement.clientWidth) stop();
  };
  // Up or down over the page (the side panel scrolls on its own; sideways is the timeline's).
  const panel = (e: Event) => {
    if (e instanceof WheelEvent && !e.deltaY) return;
    if (!(e.target as HTMLElement).closest?.('aside')) stop();
  };
  addEventListener('wheel', panel, { passive: true });
  addEventListener('touchmove', panel, { passive: true });
  addEventListener('keydown', key);
  addEventListener('pointerdown', bar);
  return () => {
    removeEventListener('wheel', panel);
    removeEventListener('touchmove', panel);
    removeEventListener('keydown', key);
    removeEventListener('pointerdown', bar);
  };
}
