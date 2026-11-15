# `src/lib/dirs.ts`

Folders kept for the visit (PF-17): `subdir(parent, name, create)` and `subpath(parent, path, create)` stand in for
`getDirectoryHandle`, and a folder found or made once is returned again without a drive call. Before, each 5 s round
looked up the script folder, `.studio/` and its folders by name again (about 15 calls a round, 1,600 on a first visit
to a 60-script list).

- **Used by:** every file that opens a folder inside the picked one (`lib/folder.ts`, `lib/history.ts`,
  `lib/comments.ts`, `lib/editing.ts`, `lib/news.ts` …), but not `lib/example.ts`, which copies the example once.
  **Tests:** `tests/unit/dirs.test.ts`, and every e2e test through the folders it opens.

## Rules and pitfalls

- Chrome's folder handles name a path, so a folder removed and made again under the same name keeps working; only a
  rename or a move breaks a kept handle, and then a look-up by name fails too.
- `forgetFolders` drops them all; `patiently` (`lib/files.ts`) calls it when a try fails. Not at the 2-minute full
  look: that cost about 250 look-ups on a 60-script list for nothing, since a kept handle answers as a look-up by
  name would (both fail for a renamed folder; a folder renamed in the list shows under its new name from the
  listing).
- A folder that isn't there isn't remembered: the next call looks again, as before.
- Keyed by the parent handle object, so a newly picked folder starts empty. A listing (`values()`) gives new handle
  objects each time: pass each through `known(parent, dir)`, or what was found inside them is lost each round.
