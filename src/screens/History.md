# `src/screens/History.svelte`

The History screen (mock-up 5): versions newest first (what changed, who, when); the picked one's changes, old
struck through and new in green, compared with the version it was made from; Restore this version. Publish
official version (mock-up 7): a named version, w1, w2 … (#240; r for sends, ap for approvals, v for older ones); with any, the small saves between them fold into one line.

- **Used by:** `screens/Editor.svelte` (the Write · History switch). **Tests:** `tests/e2e/history.spec.ts`.

## Rules and pitfalls

- Old and new text show formatting, as Write does.
- A send for review with a note shows the note under its entry (`message`, RV-8), lines kept.
- Comments (RV-6, board 48): placed by `lib/historycomments.ts`; a version shows those placed on every version since
  the one it is compared with, so an official one gathers its folded saves. One placed under a cell the picked
  version's changes don't show (changed back since) goes to the bottom list. Read-only; "Open in Review" calls
  `onOpen`, which Editor sends to Review's card. `notes` come from Editor, read again as History opens.
  PF-4: `placeComments` gets `from`, the oldest version a shown one covers, so only those get comments; it grows
  as more are shown. Pass the covered range, not just the shown 50: an official version gathers saves far below.
- The newest version is the current one: no Restore button on it.
- An official version is compared with the official one before it, of any letter (the first with the version it was
  made from). Names come from `versionNames`, never a count of their own here.
- With official versions, History opens on the newest official one, not the newest save.
- A send for review that made a version (RV-9) shows as one line, "r3 · Sent for review", without "Published by";
  one that made none is not folded and reads "Sent for review (still w2)". An approval is "ap1 · Approved" (#240).
- The Publish button sits outside the `Versions` nav, so the nav's buttons are only versions (tests count them).
- Publishing goes through `Editor.svelte` (`onPublish`): what is waiting is saved first, then script.md as it is
  on disk is what gets published.
- HI-3: only the newest 50 are listed, then "Show 50 older"; after that click a hidden marker under the list loads
  50 more whenever it comes within 400 px of view. It is watched again after each load, since older saves can fold
  into one line and leave the marker still in view. The picked version (the newest official one) is always shown.
