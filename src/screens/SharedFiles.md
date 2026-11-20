# `src/screens/SharedFiles.svelte`

Reuse a file (AS-1, board 29; #262, board 81): a window in the page, opened from "Reuse a file…" in a row's + Add.
This script's own files and links first ("In this script", each with the rows using it), then every other script's
files and links as tiles, grouped by script, newest edited first; Find narrows by name; pick one
and "Add to row N" (or double-click it) adds it to the row.
Without `onAdd` it only browses ("Files in every script", from the script list's Files, AS-1b): every script is
listed, a file or link opens in a new tab, and a script's name opens that script.

- **Used by:** `screens/FilesCell.svelte`, `screens/List.svelte`. **Tests:** `tests/e2e/shared.spec.ts`.

## Rules and pitfalls

- Built like the Settings window: a backdrop in the page, Esc or × closes it, no browser dialogs.
- Thumbnails are blob URLs of images in other scripts' folders, revoked when the window closes; a linked image uses
  its link. One that won't draw is hidden and the tile is plain.
- A file that can't be copied (still syncing, removed) says so in the footer; the window stays open.
- A file or link of this script itself is added as the same line, never copied (no "Copied from"). Its list is read
  from script.md as saved, so a link added in the last few seconds may not be in it yet; its assets/ files always are.
- A picture linked from another site is never shown (SE-1, the user's pick): only its link. See lib/csp.md.
- A file opens through `openFile` (lib/openfile.md, SE-3), never its own blob: tab: an `.html` or `.svg` from the
  folder would run as a page of the app. Links are only http(s) (`readFileRef`).
