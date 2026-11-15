// Calls back once when an element comes within about two screens of the window (AP-39): a long script's file
// previews are made as their rows come near, nearest first, not all at once when it opens. One watcher for the page.
const waiting = new Map<Element, () => void>();
let watcher: IntersectionObserver | undefined;

// Made in its own function, not inside near(): a callback made there would share near()'s variables, so the
// page-long watcher would keep the first element and its whole script alive after leaving it (PF-7).
function makeWatcher() {
  const made = new IntersectionObserver(
    (seen) => {
      for (const entry of seen) {
        if (!entry.isIntersecting) continue;
        const call = waiting.get(entry.target);
        waiting.delete(entry.target);
        made.unobserve(entry.target);
        call?.();
      }
    },
    { rootMargin: '200% 0px' },
  );
  return made;
}

export function near(node: Element, onNear: () => void) {
  watcher ??= makeWatcher();
  waiting.set(node, onNear);
  watcher.observe(node);
  return {
    destroy() {
      waiting.delete(node);
      watcher?.unobserve(node);
    },
  };
}
