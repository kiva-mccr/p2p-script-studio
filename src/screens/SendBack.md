# `src/screens/SendBack.svelte`

Review's Send back menu (#248, board 84): the notes other reviewers added this round, your note (a `TextField` with
lists, the planning panel's formatting), "Add my note" to leave it without sending, and Send back to writer, which
takes them all.

- **Used by:** `Editor.svelte`, as the `backMenu` snippet inside `Header.svelte`'s menu. Uses `lib/backnotes.ts`.
  **Tests:** `tests/e2e/backnotes.spec.ts`, `tests/e2e/comments.spec.ts`.

## Rules and pitfalls

- Your unsent text is the Editor's (`bind:text`), so closing the menu keeps it while the page is open. An added note
  of yours comes back into an empty box on the next visit.
- The notes are read again at the send, so one added a moment ago still goes. Yours is the `message`, not one of the
  `notes` (an added note of yours that you then cleared from the box is left out).
- No Cancel (board 84): Escape or a click outside closes it, as the other menus.
