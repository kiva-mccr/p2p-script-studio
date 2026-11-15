# `src/lib/history.ts`

A script's history: one JSON file per version in `.studio/versions/` (docs/studio-folder.md), written once and
never changed. Also what changed between two versions: a title ("Edited rows 3 and 4") and each changed field.

- **Used by:** `lib/scriptlist.svelte.ts` (`sinceSend`), `lib/folder.ts`, `lib/saving.svelte.ts`, `screens/Editor.svelte`, `screens/History.svelte`, `screens/Print.svelte` (through Editor); `recentVersions` by saving and the Editor. **Tests:**
  `tests/unit/history.test.ts`, `tests/e2e/history.spec.ts`.

## Rules and pitfalls

- File names only sort to the second. Versions made in the same second are ordered parent first (by how many
  versions lie before them); sorting by name alone put them in a random order (bug found while building).
- A file that can't be read (half-synced) is skipped, never an error.
- Each file is read once (HI-3, `lib/versioncache.ts`): later calls only list the folder and read new files, so
  calling `listVersions` often is cheap. Files the browser kept are found by name (PF-2), so no old file is
  opened at all. Calls for one script wait for each other: when a script opens several
  screens ask at once, and without that each did the slow first read (2,000 versions: about 3 s each).
- `recentVersions` (PF-11) is what an open script reads (saving, Review's note and round end, the tab counts, holds,
  RV-15's marks): back to the newest send, and, when no review ended after it, back to the review end or send before
  (whichever is newer); with `since` (the last visit here), back to that too. Its tests check every user gives the
  same answers as with the whole History. One known difference: a review that ended before two sends in a row is
  no longer found, so Review then shows no "What's changed" round (the last round's end is that old). Official
  numbers count every official version, so Send for review, Print, the exports and History use `listVersions`.
  Anything new on an open script that looks further back needs `listVersions` too.
- `sinceSend` (PF-3) reads names newest first, 25 at a time, and stops at the newest "Sent for review": the script
  list's For me needs nothing older (the newest send, review change and hold end are all at or after it). Versions in
  the same second as the send come too (names keep only the second). With no send, it reads everything. Its tests
  check For me gives the same answers as with the whole History; keep it so if `forMe` starts using older versions.
- Files not kept are read eight at a time (PF-10, `lib/atonce.ts`); `known` is filled in name order afterwards, so
  the answer never depends on which read finished first.
- Rows are matched by id, so a moved row is not "edited".
- A row's `Change` carries its `row` id and `field` (as comments name it, `on_screen`), so History can put a comment
  under it (RV-6); a removed row has only `row`.
- Official versions (kind `official`, or a send for review with `official: true`, RV-9: `isOfficial`) get their
  number from `officialNumbers`, by the order they were made; never stored. `officialNumber` says which one the
  script still is (printing), or 0 once anything has changed since the newest. "Changed" is `sameScript`: the
  `status` and `authors` lines are left out, since a send, approve or a save by someone new changes them.
- `sendVersion` decides what a send makes: the next number, or `still` the newest one when nothing changed, however
  that one was made (the user's rule: never a duplicate).
- `message` (RV-8, RV-13) is written only when there is one. `reviewNote` is the newest review change, if it was a send
  with a note; sent back or approved since means none. `backNote` is the newest review change if it was a send back
  (note or not), for the top of Write's Comments tab.
- `reviewEnd` is the newest `review` entry whose note starts "Sent back" or "Approved" (also "Approved, 2 still
  open"), never a send: a second round compares with when the first ended. `sinceReview` matches rows by id, like
  `describe`, so a moved row is not changed (RV-4).
- `heads` are the versions nothing was made from: two mean two saves at the same time, and `ancestor` is the
  newest version both came from (what `lib/merge.ts` compares them with). A merge version has two parents.
- `isSend` and `holdEnds` (RV-19): a send for review is a `review` entry noted "Sent for review"; holds on comments
  end at the next send or official version.
