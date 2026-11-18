# `src/screens/FilesCell.svelte`

A row's "Images & files" column: a chip for each line (a file in the script's folder opens in a new tab, a link
opens its page, plain words are shown in italics), × to remove, and + Add (choose a file, paste a link, or
describe something still to find, or pick from other scripts: `SharedFiles.svelte`, AS-1). Files in the folder show a preview above their chip (`Preview.svelte`, AP-19:
picture, PDF page 1, video, sound, first lines of text or Word); linked images show a thumbnail. Files with no
preview get their kind and size on the chip.

- **Used by:** `screens/WriteRow.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `shared.spec.ts`, `previews.spec.ts`.

## Rules and pitfalls

- The add menu closes on Escape from any of its controls (the form's own keydown, stopped there so it doesn't also
  stop playback) and on a pointerdown outside it (#263), but not while "From other scripts…" is open: that box's
  clicks are outside the form, and its Escape closes only it. Escape puts focus back on + Add. Clicks in Feedback's panel
  (`[data-feedback-ui]`) leave it open; opening the ? menu closes it, so feedback on it opens it with Shift (AP-49).
- × calls `onChange` with the shorter list, then `onRemoved(label, before)` so the row can offer Undo (UX-10).
- Previews (`lib/preview.ts`) are made from the folder's files, their blob URLs revoked when the row's files change
  or it closes. A file that is missing shows only its chip; one not really its kind (no preview made, or a video or
  sound that won't play) shows its chip with kind and size.
- AP-39: previews are made once the cell is within two screens (`use:near`). Until a file has been tried, a grey
  `.stand-in` of about its preview's size holds the place (120 px tall for a picture), so rows don't jump.
- Files only for the storyboard timeline (a line ending ` (timeline)`, SB-1) are hidden behind one
  "+2 for the timeline" chip that shows them; × still removes one.
- A file that is not there (still syncing, or renamed) gives a plain message, not an error.
- "From Sam's comment" (`came`, RV-12) works like "Copied from …".
- "Copied from …" under a chip is only kept while the cell is shown; the script does not record where a file came from.
- A picture linked from another site is never shown (SE-1, the user's pick): only its link. See lib/csp.md.
