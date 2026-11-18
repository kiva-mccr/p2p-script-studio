// A card leaving its list (RV-19, the user's ask): it slides off to the right and fades, then its space closes, so
// the cards below slide up into it. Used as `out:slideAway` on each card's wrapper in Review and Write's Comments.

import { slide, type TransitionConfig } from 'svelte/transition';
import { cubicOut } from 'svelte/easing';

export function slideAway(node: HTMLElement, { duration = 450 } = {}): TransitionConfig {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { duration: 0 };
  const height = node.offsetHeight;
  const gap = parseFloat(getComputedStyle(node.parentElement ?? node).rowGap) || 0;
  return {
    duration,
    css: (_t, u) => {
      const away = Math.min(1, u / 0.55); // first it slides out…
      const close = Math.max(0, (u - 0.55) / 0.45); // …then the gap closes
      const ease = (x: number) => 1 - (1 - x) ** 3;
      return `transform: translateX(${ease(away) * 120}px); opacity: ${1 - away}; height: ${height * (1 - ease(close))}px;
        margin-bottom: ${-gap * ease(close)}px; overflow: hidden;`;
    },
  };
}

// Something opening in the page (issue #214, the user's ask): it grows to its height instead of jumping in, so the
// page below moves down smoothly. Used as `in:grow` on what Review opens (the comment box, a reply box, On hold,
// Resolved, the review note, rows shown again).
export function grow(node: HTMLElement, { duration = 180 } = {}): TransitionConfig {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return { duration: 0 };
  return slide(node, { duration, easing: cubicOut });
}
