# `src/lib/undo.svelte.ts`

The one Undo toast (UX-1, board 72). An action calls `offer({ what, back })`; the toast shows `what` with Undo (or
`label`) for 5 seconds (UX-14; 10 before), or until the person carries on (`carryOn`: a key or a click anywhere but
the toast), and a newer offer replaces it. Write's deletes, pastes and section changes, a take deleted or
recorded again, a file removed from a row, and Restore in History all go through the Editor's `Undo`; the People
window has its own.

- **Used by:** `screens/Editor.svelte` (the toast), `screens/Write.svelte`, `screens/WriteRow.svelte`,
  `screens/People.svelte`. **Tests:** `tests/unit/undo.test.ts`, `tests/e2e/undo.spec.ts`.

## Rules and pitfalls

- `back` must put things back by itself (blocks, a take's files, a person's file): the toast doesn't know what changed.
  A take's sound is read into memory before it is deleted or replaced (`voice.hold`), so Undo writes the same bytes.
- `take` clears the toast before running `back`, so a second click can't run it twice. A `back` that fails is
  reported by the caller (the Editor shows the message).
- `carryOn` is called from the window in the capture phase (Editor, People), so a step that offers a new Undo runs
  after it and its toast stays. The toast needs `data-undo`, or clicking Undo would close it first. Tab and lone
  modifiers don't count (keyboard users reach Undo with Tab).
- Clicks are caught on `click`, not `pointerdown`: the People window is centred, so the toast going on pointerdown
  moved Done out from under the pointer and the click was lost.
- e2e tests set `undo-for` to 30 s (playwright.config.ts) so a slow save can't hide the toast before a test clicks
  Undo; the 5 s test in editor.spec removes it.
- Comment cards keep their own Undo on the card (RV-7, RV-19, the user's earlier boards); they don't use this.
