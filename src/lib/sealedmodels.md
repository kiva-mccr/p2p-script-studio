# `src/lib/sealedmodels.ts`

The sealed app's speech models (SE-5): `speech-models.zip` (the Download sealed page's second download) read in
place, checked against `models.lock.json`, and kept in IndexedDB. `zipIndex` finds each file's bytes from the zip's
central directory; `checkModels` hashes each pinned file; `keptModels` hands the zip to the speech workers
(`lib/sealedruntime.ts`). `addModels` checks and keeps a picked zip (Settings and the first-open card);
`shouldOfferModels` / `markModelsOffered` keep whether the card was shown (#327), under the key `offered`.

- **Used by:** `screens/SealedModels.svelte`, `screens/ModelsOffer.svelte`, `lib/sealedruntime.ts`. **Tests:** `tests/unit/sealedmodels.test.ts`.

## Rules and pitfalls

- Only a stored zip works (no compression): each file is a slice, nothing is unpacked. A zip made again by Windows
  or another tool is compressed and refused with a message saying to use the one downloaded.
- The kept zip carries the lock it was checked against: a new version with a new pin ignores it (Settings says it's
  for an older version).
- IndexedDB is the only storage Chrome gives a file opened from disk (OPFS throws there). The zip is ~330 MB.
- No zip64: the zip and every file in it must stay under 4 GB.
