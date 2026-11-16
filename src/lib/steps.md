# `src/lib/steps.ts`

Ctrl+Z and Ctrl+Y (or Ctrl+Shift+Z) in Write (UX-14, the user: "everything that can be done, should be able to be
undone using Ctrl+Z"). Every change this person makes to the script is a step, kept as the page's text before and
after: typing, formatting, Replace and Replace all, moves, adds, deletes, § and ¶, pastes, Put it back, files in a
row, the timeline, credits, an accepted suggestion, Restore. `settle` puts a step's text into the page in place.

- **Used by:** `lib/saving.svelte.ts` (`steps`, `edited`, `step`), `screens/Editor.svelte` (`changed`, `step`),
  `screens/Write.svelte` (the keys, the cursor). **Tests:** `tests/unit/steps.test.ts`, `tests/e2e/steps.spec.ts`.

## Rules and pitfalls

- A step is taken back by folding its change backwards into the page as it is now (`diff` and `fold`, lib/changes.ts),
  so others' saves that came in meanwhile stay. Where someone else changed the same place since, the step is dropped
  and the Editor says it can't be undone.
- Only this person's changes are steps. Anything else that changes the page must call `sync` (Saving does: others'
  saves in `#show`, the author added on a save, a status change), or the next step would take it with it.
- Typing in one box is one step while the gaps stay under a second. The box is the `input` event's target
  (`window.event`, in the Editor's `changed`); a formatting button or key is a step of its own (TextField's `apart`).
- `settle` keeps the rows' and sections' objects (Write's rows are keyed by them), so boxes and the cursor stay; it
  sets only fields that differ from the file's reading, so a space typed at the end of a box (which the file drops)
  is kept. It returns where the change is; Write puts the cursor at the end of it (or scrolls to it).
- Ctrl+Z is caught on the window in Write, also from the find bar and from buttons; other boxes (a flag's note, a
  comment, the planning panel) keep the browser's own undo. A step undone clears the Undo toast, whose `back` would
  now put back the wrong thing.
- Takes and flags are steps too (UX-15), as an `Act` (`back`, `again`, `row`) in the same list as the text's: a take
  deleted, recorded again or recorded for the first time (deleted on Ctrl+Z, written back on Ctrl+Y), a flag set,
  cleared or its note changed. The Editor runs them (`step`) and Write scrolls to their row. An Undo toast offer with
  `again` is pushed as an act, and its button takes that act back through the list (`isLast`), so the toast and
  Ctrl+Y agree.
- Not steps, on purpose: comments and suggestions (their cards have Undo), status changes (Send for review, Approve,
  Send back) and official versions, which others are told about at once, and the planning panel (its own box).
