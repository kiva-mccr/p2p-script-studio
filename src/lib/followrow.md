# `src/lib/followrow.ts`

While the script plays (AU-2), the page follows the row being played until you scroll it yourself (UX-12, board 74).
`bring(el)` scrolls a row into view only when it isn't all in view under the top bar; `watchScroll(player)` sets
`player.following` to false when you scroll the page while it plays.

- **Used by:** `screens/Write.svelte`, `screens/Review.svelte` (`bring`, only while `player.following`),
  `screens/Editor.svelte` (`watchScroll`, the "↓ Back to row N" button). **Tests:** `tests/e2e/play.spec.ts`.

## Rules and pitfalls

- "Yourself" is read from input (an up or down wheel, a touch, PageUp/PageDown/Home/End/arrows outside text fields,
  a press on the page's scroll bar), never from scroll events: the app's own smooth scrolls fire those too, and a
  wheel right after one was missed when scroll events were used.
- A wheel over the side panel (`aside`) scrolls the panel, not the page, so it doesn't count. Sideways wheels don't.
- Space is not a scroll key here: it pauses the script (`playKeys` in the Editor).
- Starting to play (`player.start`, also ▶ on a row) and Back to row follow again.
