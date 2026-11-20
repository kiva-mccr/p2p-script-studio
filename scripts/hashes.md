# `scripts/hashes.ts`

The live files' fingerprints (SE-7): the deploy runs it after the models are in `dist/` and before the attestation,
and it writes `dist/sha256sums.txt`, the SHA-256 of every file it will publish. The attestation signs that list.

## Rules and pitfalls

- Plain Node 22 (`--experimental-strip-types`), no build: imports keep their `.ts` extension.
- It must run last before the attestation: a file added to `dist/` after it would be served but not listed (the live
  check then fails on nothing, so nothing would warn).
- `hashDir` is exported for `tests/unit/livehashes.test.ts`; the script part runs only when Node runs this file.
