# `src/lib/feedbackshot.ts`

Feedback mode's picture (AP-48): `makePicture(el, blur)` draws the clicked part and what is round it as a PNG, with
an orange outline, from the page itself (modern-screenshot, MIT, loaded only when used), so the browser asks nothing.

- **Used by:** `screens/Feedback.svelte`. **Tests:** `tests/e2e/feedback.spec.ts`.

## Rules and pitfalls

- What is drawn is `pictureRoot`: the widest parent no wider than the window and no taller than 480 px (a row, the
  top bar). Drawing the whole page was slow on a long script and too big for a canvas.
- The feedback panel, strip and outline (`data-feedback-ui`) are left out; the outline is drawn on afterwards.
- `font: false`: the app's fonts are the computer's own, so nothing is fetched.
- A web link can't carry a picture, so Feedback copies it to the clipboard for the person to paste into the issue.
