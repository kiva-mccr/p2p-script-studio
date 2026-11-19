# `src/lib/memfolder.ts`

A folder of the app's own in IndexedDB, used by the sealed app's example (SE-10; the user's pick, 2026-11-19: inside
the browser, never a folder on the computer). It has the part of the File System Access API the app uses:
`getDirectoryHandle`, `getFileHandle`, `removeEntry`, `entries`/`keys`/`values`, `getFile`, `createWritable` (write,
seek, truncate, close), and permissions that are always granted.

- **Used by:** `lib/example.ts` (sealed build only). **Tests:** `tests/e2e/sealed.spec.ts` (the example in the sealed
  file: edit, reload, Start over and Undo).

## Rules and pitfalls

- Each file is one record keyed by its path ("Example/Episode …/script.md"), each folder a `{ dir: true }` record;
  removing a folder removes every key under it. Writes go to IndexedDB in order, after the folder in memory changes.
- A file keeps its old bytes until its writable closes, as in the browser; it never shows as `.crswap`.
- Errors are DOMExceptions with the browser's names (NotFoundError, TypeMismatchError, InvalidModificationError):
  the app's code checks those names.
- A new handle method the app starts using must be added here, or the sealed example breaks (only the sealed e2e
  test would show it).
