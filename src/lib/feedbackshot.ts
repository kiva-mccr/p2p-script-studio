// Feedback mode's picture (AP-48): the part that was clicked and what is round it, drawn from the page (no browser
// prompt), outlined in orange, with the script's words and people's names covered if asked. modern-screenshot is loaded only when used.

import { coverWords } from './feedback';

const OUTLINE = '#e8590c';
const PAD = 12;

/** What to draw: the widest parent of `el` that still fits the window's width and 480 px of height (its row, a bar),
 * and still holds the part: one that sticks out of its parent (the timeline's preview, above the drawer) is drawn
 * without that parent, or the picture showed the parent and not the part (issue #247). */
export function pictureRoot(el: Element): Element {
  const part = el.getBoundingClientRect();
  let root = el;
  for (let p = el.parentElement; p && p !== el.ownerDocument.body; p = p.parentElement) {
    const r = p.getBoundingClientRect();
    if (r.width > innerWidth + 1 || r.height > 480) break;
    if (part.left < r.left - 1 || part.top < r.top - 1 || part.right > r.right + 1 || part.bottom > r.bottom + 1) continue;
    root = p;
  }
  return root;
}

/** Two PNGs of the part and what is round it, outlined, from the same moment: one with the script's words and names
 * covered, one without. Both are started at once, so ticking Cover on or off only switches between them and never
 * takes a new picture of a page that has changed since the part was picked (issue #244). */
export function makePictures(el: Element): { covered: Promise<Blob>; plain: Promise<Blob> } {
  const root = pictureRoot(el);
  const ground = groundOf(root);
  const at = root.getBoundingClientRect();
  const part = el.getBoundingClientRect();
  const lib = import('modern-screenshot');
  return { covered: draw(lib, root, ground, at, part, true), plain: draw(lib, root, ground, at, part, false) };
}

/** The colour seen behind `root`: the first parent with a background (a tinted row behind one of its cells), else white.
 * The picture is laid on it, so a tint behind the part shows as it does in the app (issue #235). */
export function groundOf(root: Element): string {
  for (let p = root.parentElement; p; p = p.parentElement) {
    const bg = getComputedStyle(p).backgroundColor;
    if (bg && bg !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(bg)) return bg;
  }
  return '#ffffff';
}

async function draw(lib: Promise<typeof import('modern-screenshot')>, root: Element, ground: string, at: DOMRect, part: DOMRect, cover: boolean): Promise<Blob> {
  const { domToCanvas } = await lib;
  const scale = Math.min(2, devicePixelRatio || 1);
  const drawn = await domToCanvas(root, {
    scale,
    font: false,
    filter: (n) => !(n instanceof Element && n.closest('[data-feedback-ui]')),
    onCloneNode: cover ? (clone) => coverWords(clone as Element) : null,
  });
  const canvas = document.createElement('canvas');
  canvas.width = drawn.width + PAD * 2 * scale;
  canvas.height = drawn.height + PAD * 2 * scale;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = ground;
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.drawImage(drawn, PAD * scale, PAD * scale);
  c.strokeStyle = OUTLINE;
  c.lineWidth = 3 * scale;
  c.strokeRect((part.left - at.left + PAD - 4) * scale, (part.top - at.top + PAD - 4) * scale, (part.width + 8) * scale, (part.height + 8) * scale);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No picture'))), 'image/png'));
}
