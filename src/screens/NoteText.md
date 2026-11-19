# `src/screens/NoteText.svelte`

Notes shown with their formatting, a line each, tick box lines as real check boxes (RV-26, #248): Review's planning
notes, and the notes for the writer (Send back, and Write's Comments tab).

- **Used by:** `Planning.svelte`, `Comments.svelte`, `SendBack.svelte`. **Tests:** `tests/e2e/planning.spec.ts`,
  `tests/e2e/backnotes.spec.ts`.

## Rules and pitfalls

- Lines come from `planLines` (`lib/planning.ts`): a tick box is only "- [ ] " or "- [x] " at a line's start.
- Without `onflip` the boxes are shown disabled (another reviewer's note in Send back).
