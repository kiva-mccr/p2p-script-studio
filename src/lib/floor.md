# `src/lib/floor.ts`

`floor()`: the bottom of the window as the script sees it, the top of the timeline's drawer (SB-4) or the window's
bottom. Code that brings a row into view only "when it isn't all in view" compares with this, not `innerHeight`.

- **Used by:** `lib/followrow.ts` (`bring`: Play following the rows, a comment card), `screens/Write.svelte` (a
  click on a block), `screens/Editor.svelte` (whether "Back to row" shows), `screens/Find.svelte`. **Tests:** `tests/e2e/timeline.spec.ts` (a row behind the drawer).

## Rules and pitfalls

- The drawer also sets the page's `scroll-padding-bottom` to its height (`room` in `Timeline.svelte`), so
  `scrollIntoView` centres a row in the part above it; `floor()` only decides whether to scroll at all.
- When the script ends above the drawer (scrolled to the bottom), the drawer is under the last row, so its top is
  below every row and nothing changes.
