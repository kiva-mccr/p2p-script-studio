# `src/lib/feedback.ts`

Feedback mode (AP-48, board 71): what the clicked part is (`describe`: its name, the `.svelte` file from `data-c`,
the nearest `data-tour`, a selector, the row and column, the screen) and the GitHub issue that carries it
(`issueTitle`, `issueBody`, `issueUrl`, `plainText`). `coverWords` covers the script's words and people's names in the
picture's copy of the page with solid grey boxes. Built so the issue can be acted on straight away (the user's ask): always the same shape, `feedback` label.

- **Used by:** `screens/Feedback.svelte`, `lib/feedbackshot.ts`. **Tests:** `tests/unit/feedback.test.ts`,
  `tests/e2e/feedback.spec.ts`.

## Rules and pitfalls

- The repo is public: nothing from the script goes in unless the person ticks Say which script (then the script's
  folder name and the page's address). A part's name comes from its label (aria-label, title, a button's own words),
  never a text box's contents; a name that looks like a file or path ("leaf.jpg", "../x") becomes "(a file)".
- A click on an icon's drawing means the button it's in (`partOf`).
- The selector starts from the nearest id, row (`data-row`) or a `data-tour` used only once: `data-tour="row"` is on
  every row, so it found the wrong one.
- The row number is read from a label inside the row ("Dialogue, row 3"), since `data-block` counts sections too.
- `coverWords` runs on modern-screenshot's copy, whose elements may belong to another document: no `instanceof`.
  In rows, a button's own words are covered unless it has an aria-label (file chips have none, icons do).
- Never a blur (the user, 2026-11-16: it can be undone): opaque grey boxes, and the text under them is swapped for
  x's, so it is not in the copy at all. The copy carries every element's styles inline, so the box's styles need
  `!important` (without it the words showed through). A text box is swapped for a div of the same look.
- A name in a control (Presence's buttons, Review's folded note) goes in a `data-hide` span; the app's own words
  outside controls ("In review", "Saved", the list's statuses) get `data-keep`. A new place that shows a name inside
  a button must mark it.
- The note is cut at 2,000 characters so the link stays well under GitHub's length limit.
- The `feedback` label in the link is only applied for people who may label issues; others' issues come unlabelled.
