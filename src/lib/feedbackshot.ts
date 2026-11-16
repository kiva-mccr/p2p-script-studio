// Feedback mode's picture (AP-48): the part that was clicked and what is round it, drawn from the page (no browser
// prompt), outlined in orange, with the script's words and people's names covered if asked. modern-screenshot is loaded only when used.

import { coverWords } from './feedback';

const OUTLINE = '#e8590c';
const PAD = 12;

/** What to draw: the widest parent of `el` that still fits the window's width and 480 px of height (its row, a bar). */
export function pictureRoot(el: Element): Element {
  let root = el;
  for (let p = el.parentElement; p && p !== el.ownerDocument.body; p = p.parentElement) {
    const r = p.getBoundingClientRect();
    if (r.width > innerWidth + 1 || r.height > 480) break;
    root = p;
  }
  return root;
}

/** A PNG of the part and what is round it, outlined. */
export async function makePicture(el: Element, cover: boolean): Promise<Blob> {
  const root = pictureRoot(el);
  const { domToCanvas } = await import('modern-screenshot');
  const scale = Math.min(2, devicePixelRatio || 1);
  const drawn = await domToCanvas(root, {
    scale,
    backgroundColor: '#ffffff',
    font: false,
    filter: (n) => !(n instanceof Element && n.closest('[data-feedback-ui]')),
    onCloneNode: cover ? (clone) => coverWords(clone as Element) : null,
  });
  const at = root.getBoundingClientRect();
  const part = el.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.width = drawn.width + PAD * 2 * scale;
  canvas.height = drawn.height + PAD * 2 * scale;
  const c = canvas.getContext('2d')!;
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.drawImage(drawn, PAD * scale, PAD * scale);
  c.strokeStyle = OUTLINE;
  c.lineWidth = 3 * scale;
  c.strokeRect((part.left - at.left + PAD - 4) * scale, (part.top - at.top + PAD - 4) * scale, (part.width + 8) * scale, (part.height + 8) * scale);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No picture'))), 'image/png'));
}
