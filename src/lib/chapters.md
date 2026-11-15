# `src/lib/chapters.ts`

History in chapters (PF-13, docs/studio-folder.md): the file format of `.studio/chapters/` (100 older versions in one
gzip file), reading and writing one, and what a chapter holds (`contents`), remembered so a chapter is opened once
per computer.

- **Used by:** `lib/history.ts` (reading), `lib/pack.ts` (writing). **Tests:** `tests/unit/pack.test.ts`,
  `tests/e2e/chapters.spec.ts`.

## Rules and pitfalls

- A chapter's name is its first and last version file's names and a random id: sorting names sorts chapters, the
  range tells which version files it may hold without opening it, and two keepers packing at once write two files,
  never one file twice. Readers count a version once, by its file's name.
- Read with `arrayBuffer()` and then unpacked (not `file.stream()`): every other file is read whole too, and the perf
  probe counts bytes that way.
- A chapter that can't be unpacked or parsed (still syncing, cut short) is null and read again next time; a version
  inside is kept only if its id matches its file's name.
- What a chapter holds (`packed`, names) is kept in this browser (`script-studio-chapters`); its versions go to the
  History store (lib/versioncache) under their file's names, so they line up with single files.
