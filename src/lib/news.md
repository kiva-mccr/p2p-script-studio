# `src/lib/news.ts`

One "what's new" folder for the whole drive (PF-15, docs/studio-folder.md): `announce(dir, what)` drops a
written-once note in the picked folder's `.studio/news/` after a write in a script folder that `follow` was told
about (Saving.open does it); `News.look()` lists that folder and says which scripts have notes it hasn't seen.

- **Used by:** the writers (`changefiles`, `folder`, `history`, `comments`, `voice`, `planning`), `lib/saving` (follow),
  `screens/Editor.svelte` (the 5 s check) and `lib/scriptlist` (the list). **Tests:** `tests/e2e/news.spec.ts`,
  `tests/unit/news.test.ts`.

## Rules and pitfalls

- Only names are read: `<time>_<random>_<script folder>.json`. The folder name comes last, since it can hold `_`.
- The note goes after the file it is about is closed, so a reader never finds the note before the file. A synced
  folder may still bring them in out of order, so the Editor looks once more the round after a note.
- `look()` returns null (look at everything) the first time, every `FULL_EVERY` (2 min; `full-every` in this
  browser's storage shortens it for tests), and when the folder can't be read. Edits made outside the app leave no
  note: only that full look finds them. The full look also removes notes over an hour old (by their name's time).
- A failed note never fails the write: the full look finds the change.
- The Editor skips this tab's own notes (`look(true)`); the list doesn't, since your own saves change its counts.
- Writes in a folder never opened in this tab (a new script from the list) leave no note: the list sees new folders
  in its listing of the picked folder anyway.
- Tests: `writeFile` in `tests/e2e/folder.ts` drops a note for any file in a script folder, as another computer's app
  would; `{ outside: true }` stands for Notepad or Explorer.
