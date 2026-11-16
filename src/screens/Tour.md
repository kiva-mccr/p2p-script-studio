# `src/screens/Tour.svelte`

The guided tour's card and dimming (AP-34, board 53): a ring round the part a step points at, the rest dimmed and
not clickable, and a card beside it (below, above, right or left, whichever fits) with Skip tour, Back and Next,
ending on "Your turn". → and ← step, Esc skips. The steps are `lib/tour.ts`.

- **Used by:** `screens/Editor.svelte`, only in the example (App.svelte passes `tour`, which goes up when Take the
  tour is clicked). **Tests:** `tests/e2e/tour.spec.ts`.

## Rules and pitfalls

- A tab's tour waits for its first part to be drawn (the script takes a moment to open). A part that isn't on the
  page then (a hidden note) is left out of that run. It first waits up to 1 s for the other parts: who was here
  (`presence`) is read from the folder after the script shows, and was left out now and then before that wait.
- Parts that only show on hover (a row's tools) are shown with the `tour-on` class (`app.css`). Pieces beside the part
  marked `data-tour-with` are ringed with it: a row's flag and § sit outside its tools. Never mark repeated
  siblings (every row) as pieces: the ring would cover them all.
- `again` is read once when it mounts, so opening another script after Take the tour doesn't play it again.
- The top bar stays up over the page and the timeline's drawer over its foot: a part under either counts as off screen
  (html's `scroll-padding-top` and `-bottom` are their heights). Before this, a step whose part sat just under the
  bar (Assets' Order, after step 1 scrolled the list up) was ringed behind the tabs.
- A sticky part (the timeline's drawer) is treated like one in the top bar and never scrolled to: it sits inside
  html's bottom scroll padding (its own height), so it always looked off screen and was scrolled for nothing.
- `unfold` steps open the drawer (`drawer()` sends `tour-drawer`); `finish` folds it, so every way out of the tour
  (Skip, Esc, Start playing) puts it back.
