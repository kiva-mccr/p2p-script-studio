# `src/lib/scriptlist.svelte.ts`

The script list's facts (AP-40): each script's title, status, last edit and counts (length, missing, flagged, For
me), kept in this browser's localStorage (`script-list:<folder name>`) with a fingerprint of the script's files.
`ScriptList.refresh` lists the folder, reads the title and status of scripts the browser hasn't seen (all of them,
so the list shows whole), then checks each script's fingerprint and reads only the scripts that changed, those on
screen first, four at a time.

- **Used by:** `screens/List.svelte`. **Tests:** `tests/unit/scriptlist.test.ts`, `tests/e2e/listcache.spec.ts`,
  and the list's other e2e tests.

## Rules and pitfalls

- The take dates in `basePrint` are read eight at a time (PF-10), inside the four scripts at a time (`WORKERS`):
  up to ~32 reads at the drive on a first visit.
- The fingerprint opens no file: script.md's size and date, the names in `.studio/versions/` and `.studio/comments/`
  (written once, never changed), the takes' sizes and dates (`voice/` files are rewritten), the names in the folders
  the Files column points into (for the missing count), and your name (For me depends on it).
- The fingerprint is taken before the script is read, so a change during the read is caught next time, never lost.
- A file being written shows as `name.crswap` for a moment: the fingerprint changes twice and the script is read
  twice. Harmless.
- Anything that can't be read keeps what was shown and is read next time (mid-sync).
- History is read only back to the newest send for review (`sinceSend`, PF-3): a big History made the first visit read
  115 MB for 60 scripts. An approved script's History isn't read at all.
- The news folder (PF-15, `lib/news.ts`): coming back to the list or the window within 2 minutes of the last full look
  checks only scripts with a new note (yours too) and scripts never counted; otherwise every script's fingerprint, as
  above. The news folder as last seen is kept for the tab (`watching`), not in localStorage: a reload looks fully.
- The shared summary (PF-12, `lib/summary.ts`): a script read the slow way leaves one; a script this browser hasn't
  seen is shown from the newest summary while its fingerprint (without your name) still matches, before any title or
  status is read. `Kept.shared` says a summary with these counts is there; a script remembered without it (counted
  before PF-12) is read once more if no summary matches, so computers that already know the folder leave summaries
  too. A script with no usable summary has its fingerprint taken once a round (`tried`), not twice.
- The counts in localStorage never hold `forAll` (everyone's For me), only yours.
- Changes waiting in `.studio/changes/` (FX-2) aren't counted until the keeper writes script.md, as before.
