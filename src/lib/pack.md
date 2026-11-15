# `src/lib/pack.ts`

The keeper's tidying of History (PF-13): `tidyHistory` does one step, removing the single files of one chapter packed
over 3 days ago, or else packing the oldest 100 loose version files into a chapter (lib/chapters.ts).

- **Used by:** `lib/saving.svelte.ts` (after the keeper's work, never awaited by a save). **Tests:**
  `tests/unit/pack.test.ts`, `tests/e2e/chapters.spec.ts`.

## Rules and pitfalls

- Loose means newer by name than the newest chapter's last file. Packing waits for 125 loose, so 25 or more recent
  versions always stay single files: opening a script, the list and `lastEditor` mostly read only those.
- Packing needs every one of the 100 read whole; one still syncing waits for a later step.
- Only files a chapter really holds are removed (it was read whole to know), and only after `KEEP` (3 days): computers
  still syncing the chapter, and tabs on an older copy of the app (which read only `versions/`), lose nothing.
- One step per call, and Saving calls again at its next check only while there's more (else every 10 minutes): a
  2,000-version script is packed over a few dozen checks, not in one long burst.
- Tests shorten it with `chapter-size` and `chapter-keep` (ms) in this browser's storage.
