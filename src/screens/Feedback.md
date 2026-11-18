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
- Holding Shift lets everything through (AP-49), to open a menu or dropdown; the outline hides and the cursor is
  normal (`feedback-through` on `<html>`). A press begun with Shift lets its release and click through even if Shift
  is let go first, else the click picked the button that opens the menu. Menus stay open after because their
  close-on-click-away listens on `window` without capture, which the picking's capture listener stops.
- A scroll bar (the timeline's, issue #252) is dragged by the browser whatever `preventDefault` says, and no click
  follows a press on it: so a press on one (`onScrollbar` in lib/feedback.ts) picks at once, and the box is scrolled
  back to where it was until the button is let go (`keepScroll`). The page's own scroll bar still scrolls.
- Open on GitHub copies the picture first, then opens the issue page: Chrome lets a page open a tab a few seconds
  after a click, so the await is fine, but the other way round the clipboard fails once the new tab has the focus.
- The panel is placed by its measured size (`placePanel` in lib/feedback.ts): below the part, else above, else
  shifted to fit. Placed by a guessed height, it opened above a part and was cut off at the top (a bug the user hit).
- The strip sits at the bottom of the window, not under the top bar, so it never covers a part to pick.
- A slow picture never replaces a newer one (`made` counts them); old picture URLs are revoked.
- Nothing is sent by the app: GitHub's page shows everything before the person presses Submit.
- The note starts empty for each piece of feedback: Cancel or Close clears it, and so does picking again after it was
  sent or copied. It used to be one value for the whole visit, so the last note came back (a bug the user hit).
