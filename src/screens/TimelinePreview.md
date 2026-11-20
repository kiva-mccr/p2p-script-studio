# `src/screens/TimelinePreview.svelte`

The storyboard timeline's preview while playing (#226, board 85): the picture of the moment (`PreviewShot.svelte`),
its label, the time, ⤢ and ✕. Its own file so Timeline.svelte doesn't grow.

- **Used by:** `screens/Timeline.svelte` (the `preview` snippet). **Tests:** `tests/e2e/timeline.spec.ts`; the box's
  maths `tests/unit/floatbox.test.ts`.

## Rules and pitfalls

- The clock (time / total) is the app's, so Feedback's Cover leaves it readable (issue #334); the card's words are
  `data-hide` (lib/feedback.md).
- Three places: `.docked` in the open drawer, right of the tracks (220 px, upright 140 px); folded, `position:
  absolute` above the drawer's right end, capped by `--room` (the screen's height less the top bar, `--drawer` and its
  gap and bar) so upright never runs off the top of a short window; `.big`, `position: fixed` at the kept box.
- Big: the bar is on top (the handle; a press on its other buttons doesn't drag), the resize corner is `.corner`.
  Both use pointer capture; the box shown is always `fitBox` of what was asked (`lib/floatbox.ts`), and only that is
  kept (`timeline-preview-wide` / `timeline-preview-upright`), on letting go or each arrow key.
- The corner follows whichever way the pointer went further (across, or down in the picture's shape):
  `Math.max(dx, dy / ratio)` only ever grew it.
- The room is the window less 12 px at each side, the top bar (`--bar-h`) and the drawer (`drawer`): never over
  the timeline, never under the top bar.
- The time never wraps (it ellipsizes): a wrapped bar made the small upright preview taller and ran it under the top
  bar in a short window.
