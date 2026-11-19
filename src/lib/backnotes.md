# `src/lib/backnotes.ts`

Notes for the writer from several reviewers (#248, board 84): `.studio/notes/`, one file per note added, changed,
ticked or deleted (docs/studio-folder.md). The newest file about a note counts.

- **Used by:** `screens/SendBack.svelte` (adding, the send back), `screens/Comments.svelte` (ticks in Write),
  `lib/history.ts` (`SentNote`, a send back's `notes`). **Tests:** `tests/unit/backnotes.test.ts`,
  `tests/e2e/backnotes.spec.ts`.

## Rules and pitfalls

- `made` is when the note was first added and never changes; `when` is the file's own time. `waiting` goes by `made`,
  so a tick in Write (a newer file) never brings an old note into the next round.
- The round starts at the newest "Sent for review"; with none in History every note counts.
- The sender's own note is the send back's `message`; its ticks go by the send back's id.
- Names sort by time (`<time with ms>_<note id>_<random>.json`), so the last one read counts. A file still being
  written is skipped; the next read finds it.
- Writers call `announce`, so the others' checks look inside the script.
