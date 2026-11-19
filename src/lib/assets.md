# `src/lib/assets.ts`

The asset list (EX-6, board 12): `assetRows` (each row with its section and its files, links and notes),
`assetList` (each asset once, with the rows that use it), `missingFiles` (the paths not in the script's folder) and
`countMissing` (for the script list), and `stillToFind` (a row's missing files and "to find" notes, for the
video's placeholder cards, #227). Each row also carries its `excerpt` (#212): its dialogue, or its On screen
words, as one line without marks or bullets.

- **Used by:** `screens/Assets.svelte`, `screens/Editor.svelte`, `screens/List.svelte`, `screens/Export.svelte`. **Tests:**
  `tests/unit/assets.test.ts`, `tests/unit/checkreads.test.ts`, `tests/e2e/assets.spec.ts`.

## Rules and pitfalls

- An asset is the same when its path or link is the same; a "to find" note when its words are, ignoring case.
- Only paths are checked: links aren't fetched (no server, and many sites refuse it).
- `excerpt` uses `clearMarks` (no DOM), not `plain`, so it needs no DOM and runs in unit tests.
- It imports `folder.ts`, so `folder.ts` must never import it (a cycle); the script list counts in `List.svelte`.
- `missingFiles` lists each folder named in the Files column once (PF-1), then looks up only the names not in the
  list, as before, so a path differing from the file only in case still counts as there on Windows. A folder that
  isn't there makes all its files missing at once (PF-17): the folder look-up already ignores case.
