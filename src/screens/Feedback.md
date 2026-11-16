# `src/screens/Feedback.svelte`

Feedback mode (AP-48, board 71): started by Feedback… in the ? menu of the top bar (`HelpMenu.svelte`, through
`lib/help.svelte.ts`; mounted once by `App.svelte`),
the strip and orange outline while picking, and the panel by the picked part: a note, the picture (ticks: add it,
blur the script's words, say which script), Open on GitHub, Copy instead, Cancel.

- **Used by:** `App.svelte`. **Tests:** `tests/e2e/feedback.spec.ts`.

## Rules and pitfalls

- While picking, clicks, presses and keys are caught on `window` in the capture phase, before the page's own
  handlers, so the click only picks (no recording starts, no box gets the cursor). Anything inside
  `data-feedback-ui` works as normal. Esc stops.
- Open on GitHub copies the picture first, then opens the issue page: Chrome lets a page open a tab a few seconds
  after a click, so the await is fine, but the other way round the clipboard fails once the new tab has the focus.
- The panel is placed by its measured size (`placePanel` in lib/feedback.ts): below the part, else above, else
  shifted to fit. Placed by a guessed height, it opened above a part and was cut off at the top (a bug the user hit).
- The strip sits at the bottom of the window, not under the top bar, so it never covers a part to pick.
- A slow picture never replaces a newer one (`made` counts them); old picture URLs are revoked.
- Nothing is sent by the app: GitHub's page shows everything before the person presses Submit.
- The note starts empty for each piece of feedback: Cancel or Close clears it, and so does picking again after it was
  sent or copied. It used to be one value for the whole visit, so the last note came back (a bug the user hit).
