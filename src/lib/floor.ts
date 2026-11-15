// The bottom of the part of the window the script shows in: the top of the timeline's drawer (SB-4), which stays at
// the bottom of the screen, or the window's bottom when there is none. A row lower than this is behind the drawer.
export function floor(): number {
  const drawer = document.querySelector('section.timeline')?.getBoundingClientRect().top;
  return Math.min(innerHeight, drawer ?? innerHeight);
}
