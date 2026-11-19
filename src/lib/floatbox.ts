// The big preview's box (#226, board 85): where it floats and how wide. It is moved and resized by hand and kept in
// this browser, but always shown inside the room between the top bar and the timeline's drawer.

export type Box = { x: number; y: number; w: number }; // its top-left corner and width, in px
export type Room = { left: number; top: number; right: number; bottom: number };

// ratio: the picture's height over its width; extra: the bar's height. The width is never more than fits the room,
// and at least `min` when that fits; then the box is moved back inside it.
export function fitBox(box: Box, room: Room, ratio: number, extra: number, min = 200): Box {
  const most = Math.max(0, Math.min(room.right - room.left, (room.bottom - room.top - extra) / ratio));
  const w = Math.min(most, Math.max(min, box.w));
  const h = w * ratio + extra;
  const x = Math.max(room.left, Math.min(box.x, room.right - w));
  const y = Math.max(room.top, Math.min(box.y, room.bottom - h));
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w) };
}

// Before it has been moved: `wanted` wide (or what fits), in the room's bottom right corner, above the drawer's right
// end as the small preview was.
export function startBox(room: Room, ratio: number, extra: number, wanted: number): Box {
  const { w } = fitBox({ x: room.left, y: room.top, w: wanted }, room, ratio, extra);
  return fitBox({ x: room.right - w, y: room.bottom - (w * ratio + extra), w }, room, ratio, extra);
}

// A kept box, or null if there is none or it isn't one.
export function readBox(text: string): Box | null {
  try {
    const b = JSON.parse(text);
    return [b?.x, b?.y, b?.w].every((n) => typeof n === 'number' && Number.isFinite(n)) ? { x: b.x, y: b.y, w: b.w } : null;
  } catch {
    return null;
  }
}
