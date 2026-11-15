# `src/lib/feedback.ts`

Feedback mode (AP-48, board 71): what the clicked part is (`describe`: its name, the `.svelte` file from `data-c`,
the nearest `data-tour`, a selector, the row and column, the screen) and the GitHub issue that carries it
(`issueTitle`, `issueBody`, `issueUrl`, `plainText`). `blurWords` blurs the script's words in the picture's copy of
the page. Built so the issue can be acted on straight away (the user's ask): always the same shape, `feedback` label.

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
- `blurWords` runs on modern-screenshot's copy, whose elements may belong to another document: no `instanceof`.
  In rows, a button's own words are blurred unless it has an aria-label (file chips have none, icons do).
- The note is cut at 2,000 characters so the link stays well under GitHub's length limit.
- The `feedback` label in the link is only applied for people who may label issues; others' issues come unlabelled.
