# `src/lib/autoresolve.ts`

Comments that lose their place (RV-24, issue #249, board 81). A save of this person's that deletes a row resolves the
open comments and suggestions on it, and one that replaces the words a comment is on resolves that comment; what
was there is kept in the `resolve` note (`why`, `was`, `now`, `n`, `after`, docs/studio-folder.md), so nothing is
lost for later scripts. A save that brings the row or the words back (Undo, Ctrl+Z) reopens them.

- **Used by:** `screens/Editor.svelte` (through `Saving.saved`, called after each change file is written). **Tests:**
  `tests/unit/autoresolve.test.ts`, `tests/e2e/comments.spec.ts`, `tests/e2e/review.spec.ts`.

## Rules and pitfalls

- Only the person whose save made the change writes the notes: others fold that change in through `sync`, which
  never calls `saved`. Two people deleting the same row at once both write a resolve; that's harmless.
- Reopens only what a save resolved (`Thread.gone`, the newest resolve with a `why`): a comment someone resolved by
  hand stays resolved when its row comes back.
- Deleting a row (and its Undo toast) saves at once (`deleted` in the Editor), so its comments move as it goes.
  Ctrl+Z bringing a row back waits for the usual save (up to 30 s).
- A deleted row's words are the comment's own column, else the first column with anything in it, as the page shows
  them (`plain`, which needs the page; tests pass their own `flat`).
- Replaced words: `changed` finds what differs around the quote (common start and end), widened to whole words but
  not the punctuation after them. Words someone else changed, or that were already gone on opening, still show "On
  text that has since changed" (nothing to compare with).
- `after` (the row before, '' for the first) keeps a deleted row's comments in their place in line order
  (`lib/commentsort.ts`); the issue's follow-up asked for that.
