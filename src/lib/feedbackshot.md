# `src/lib/feedbackshot.ts`

Feedback mode's picture (AP-48): `makePictures(el)` draws the clicked part and what is round it as two PNGs (words
covered, and not), with an orange outline, from the page itself (modern-screenshot, MIT, loaded only when used), so the browser asks nothing.

- **Used by:** `screens/Feedback.svelte`. **Tests:** `tests/e2e/feedback.spec.ts`.

## Rules and pitfalls

- What is drawn is `pictureRoot`: the widest parent no wider than the window and no taller than 480 px (a row, the
  top bar). Drawing the whole page was slow on a long script and too big for a canvas.
- It stops at a parent that doesn't hold the whole part: a part placed outside its parent (the timeline's preview sits
  above the drawer, `position: absolute`) isn't in that parent's picture, so the picture showed the fold bar with the
  outline off its edge (issue #247).
- A parent that doesn't hold the part is skipped, not the end: the comment bubble sticks out of its number cell by a
  few pixels, so the picture was of the bubble alone, not its row (issue #235).
- No `backgroundColor` for modern-screenshot: it paints over the drawn part's own background, so a chosen row's blue
  came out white (issue #235). The picture is laid instead on the colour behind it (`groundOf`: the first parent with
  a background, else white), so a cell of a tinted row keeps the tint round it too.
- The feedback panel, strip and outline (`data-feedback-ui`) are left out; the outline is drawn on afterwards.
- `font: false`: the app's fonts are the computer's own, so nothing is fetched.
- Both pictures are started at once when the part is picked, and Cover only chooses between them: making a new one
  on each tick showed the page as it was by then, not as it was when picked (issue #244).
- A web link can't carry a picture, so Feedback copies it to the clipboard for the person to paste into the issue.
