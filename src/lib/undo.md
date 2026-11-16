# `src/lib/undo.svelte.ts`

The one Undo toast (UX-1, board 72). An action calls `offer({ what, back })`; the toast shows `what` with Undo (or
`label`) for 10 seconds, and a newer offer replaces it. Write's deletes, pastes and section changes, a take deleted or
recorded again, a file removed from a row, and Restore in History all go through the Editor's `Undo`; the People
window has its own.

- **Used by:** `screens/Editor.svelte` (the toast), `screens/Write.svelte`, `screens/WriteRow.svelte`,
  `screens/People.svelte`. **Tests:** `tests/unit/undo.test.ts`, `tests/e2e/undo.spec.ts`.

## Rules and pitfalls

- `back` must put things back by itself (blocks, a take's files, a person's file): the toast doesn't know what changed.
  A take's sound is read into memory before it is deleted or replaced (`voice.hold`), so Undo writes the same bytes.
- `take` clears the toast before running `back`, so a second click can't run it twice. A `back` that fails is
  reported by the caller (the Editor shows the message).
- Ctrl+Z in Write is `lib/steps.ts`, not this toast; undoing a step there clears the toast. An offer with `again` (a
  take) is also a Ctrl+Z step: the Editor's `offer` pushes it and its button undoes it through the steps.
- Comment cards keep their own Undo on the card (RV-7, RV-19, the user's earlier boards); they don't use this.
