# `src/lib/editing.ts`

"Sam is editing": a small file per person in `.studio/editing/` (docs/studio-folder.md), a new one every 60 s while
the script is open (the person's older ones removed); on leaving, a last one marked `left` (AP-37). `writerOf` says
whose a script.md is; `whoWasHere`, `lastHereText` and `seenWhen` say who has been here ("Sam · 12 min ago" in the bar).

- **Used by:** `lib/saving.svelte.ts`, `screens/Presence.svelte`. **Tests:** `tests/unit/editing.test.ts`, `tests/e2e/conflict.spec.ts`.

## Rules and pitfalls

- Never rewritten (FX-2): a new `sam_<time>.json` each time, since a network drive refuses to replace a file another
  computer is reading. The newest per person counts; `sam.json` from before is read and removed too.
- `since` is when the person opened the script: the earliest among fresh files is the keeper (`lib/saving.svelte.ts`).
- A file whose `seen` is over 3 minutes old means the person has gone (closed laptop); it is not shown, but its
  `last_written` still credits their last save to them when the script is opened.
- Heartbeat 60 s, gone after 3 minutes (PF-18; were 30 s and 2 minutes): half the folder calls, at the cost of a closed
  laptop showing as editing, and the keeper handing over, up to a minute later. Keep "gone" at least 2 heartbeats
  plus a slow drive's delay, or a live person flickers out between files.
- File names come from the person's name, lowercased, with anything but letters and digits made `-`; your own file
  is matched by that name, not by exact spelling.
- A half-synced file that can't be read is skipped.
- A `left` file is never "editing" (`isEditing`), however fresh, so the one who left never stays keeper. An app from
  before AP-37 still open elsewhere reads it as editing for up to 3 minutes; harmless once everyone reloads.
- Gone without leaving (no `left`, `seen` over 3 minutes old) is "quiet" (an amber ring in the bar, "last seen" in the list), for 2 hours: the
  laptop slept or lost the drive, and their last typing may not be in. Then it reads as an ordinary "was here".
- `readEditing` removes anyone's file over 30 days old, at every 5 s check; such files are not listed either.
