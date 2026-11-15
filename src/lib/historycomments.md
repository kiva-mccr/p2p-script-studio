# `src/lib/historycomments.ts`

Comments in History (RV-6, board 48): `placeComments` puts each comment and suggestion on one version, under the
cell it led to change, or on the version current when it was made if nothing has changed it since. `stateText` is
the label History shows (Open, Resolved by Sam, Accepted by Sam …).

- **Used by:** `screens/History.svelte`. **Tests:** `tests/unit/historycomments.test.ts`, `tests/e2e/history.spec.ts`.

## Rules and pitfalls

- A comment goes on the first version made after it that changed its cell (row and field), compared with the
  version that one was made from. Any change to the cell counts, not only to the quoted words.
- Versions are written at most every 5 minutes, with the text as it is then: a comment made just after an edit
  but before its version was written lands on that version. Accepted, as the edit came close to it anyway.
- Comment times keep milliseconds and version times seconds: both are compared as times, never as strings.
- A comment made before the first version (the folder had comments before History) goes on the first version.
- Nothing is stored: it is all worked out from the versions and the comments each time History opens. Which cells a
  version changed is kept in memory for the visit (versions never change), checked against both texts.
- Only the versions History shows get comments (`from`, PF-4); older ones are looked at only for comments made before
  them, to see whether their cell changed first. Check every version in between, never just the two ends: a change
  undone later (a restore) still takes the comment, and the made-up speed-check script undoes every edit.
- Rows are compared as text (the lines after each row's heading) and parsed only when they differ: parsing all 2,000
  versions whole froze History for over a second and took 300 MB. A row's heading line itself (its number) is not a
  cell, so renumbering rows changes nothing.
- A comment on hold (RV-19) shows "On hold by …"; History passes `holdEnds` of its loaded versions, so one held before
  a send it hasn't loaded yet (HI-3) can still show as on hold.
