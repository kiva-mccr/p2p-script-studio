# `src/lib/zip.ts`

A .zip made in the browser for Resolve / Premiere (EX-19): `zip(entries)` gives a Blob, `crc32` its checksums.

- **Used by:** `lib/editmedia.ts`. **Tests:** `tests/unit/zip.test.ts`, `tests/e2e/editexport.spec.ts`.

## Rules and pitfalls

- Files are stored, not compressed: the media in it is already compressed (or WAV, which barely shrinks), and it
  keeps the code small with no library.
- Names are UTF-8 (flag bit 11), so titles with accents unpack right in Windows' Explorer and macOS.
- No ZIP64: each file and the whole zip must stay under 4 GB. A script's stills and takes are far below that; a long
  4K video in Files could not be (not seen yet).
