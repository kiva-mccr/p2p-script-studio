# `src/lib/versioncache.ts`

History files are written once and never changed, so `listVersions` (lib/history.ts) reads each one only once
(HI-3): kept in memory for this visit (per script folder, by file name) and in this browser's IndexedDB
(`script-studio-history`) for later visits. Nothing is written to the shared folder.

`browserStore(name, version)` is the store itself; comments keep their notes in one too (PF-9, `lib/comments.ts`).

- **Used by:** `lib/history.ts`, `lib/comments.ts`. **Tests:** `tests/unit/versioncache.test.ts`, `tests/e2e/history.spec.ts`.

## Rules and pitfalls

- The browser's key is the script folder's name and the file's name (`nameKey`, PF-2): test scripts reuse short ids
  across scripts, so the file's name alone could mix two scripts' files. A file's name holds its second and a random
  id, so the same name in the same script is the same file. Memory is per folder handle, so the name is enough there.
- Never open a file to find it in the browser's store (PF-2): the old key (name, size and time) opened every History
  file on every open just to look at its size, 2,000 files a script. A kept version is used only if its id matches
  the file's name. The store's version 2 dropped version 1's entries.
- Kept versions are fetched a hundred at a time with a pause between: all 2,000 at once (about 100 MB of text)
  held up drawing the script by a quarter of a second.
- Every store's one object store is called `versions` (comments' too). Raising a store's version empties it.
- Only whole, readable versions are kept: a half-synced file is read again next time.
- Storage refused (a private window) or missing (unit tests run in Node): nothing is kept and the files are read.
- A first visit on a computer still reads every file; only "chapters" (index files, left for later in HI-3) would
  change that.
