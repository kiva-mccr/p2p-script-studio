# `src/lib/floatbox.ts`

The big preview's box (#226, board 85): `fitBox` keeps a moved or resized box inside the room between the top bar and
the timeline's drawer, `startBox` places it before it has been moved (bottom right, above the drawer's right end),
`readBox` reads a kept one.

- **Used by:** `screens/TimelinePreview.svelte`. **Tests:** `tests/unit/floatbox.test.ts`, `tests/e2e/timeline.spec.ts`.

## Rules and pitfalls

- The kept box is what was asked for, never the fitted one: a short window (or the drawer opened) shrinks and moves it
  only while it lacks room, and it comes back when there is room again.
- Width is the only size: the height follows from the picture's shape (`ratio`) plus the bar (`extra`).
- Fitting shrinks first, then moves: a box wider than the room is never pushed off its left edge. The least width
  (`min`) gives way to the room: in a short window upright, it would have run into the drawer.
