# `src/lib/numberruns.ts`

Numbered files folded together (EX-25, issue #255, board 86): `numberRuns` splits a sorted list of file names into
runs whose names differ only by their last number (card-row-1.png … card-row-4.png); a run of `FOLD_FROM` (3) or
more is shown as first ↓ "N files" ↓ last.

- **Used by:** `screens/EditPreview.svelte` (the Resolve / Premiere export's "In the .zip" list).
  **Tests:** `tests/unit/numberruns.test.ts`, `tests/e2e/editexport.spec.ts`.

## Rules and pitfalls

- Only neighbours join a run, so the list must already be sorted with numbers in order (`localeCompare` with
  `numeric: true`), or take-10 lands between take-1 and take-2.
- Only the last number counts: row-2-collage.png and row-3-collage.png join, take-1-b.wav and take-2-a.wav don't.
- The numbers needn't follow on (card-row-3, 5, 9 still fold): the list only shortens, it says nothing is missing.
- `same` keeps apart files that differ in more than the name, e.g. their "(from …)" note in the export list.
- Only the list folds; the zip still holds every file.
