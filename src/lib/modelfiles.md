# `src/lib/modelfiles.ts`

What the deploy, the app and the live check share about the pinned speech models (SE-5): the lock's type, the zip's
name, the facts beside the site (`speech-models.json`) and the release tag of a pin.

- **Used by:** `scripts/models.ts`, `scripts/livecheck.ts`, `lib/models.ts`, `lib/sealedmodels.ts`,
  `screens/DownloadSealed.svelte`, `screens/SealedModels.svelte`. **Tests:** `tests/unit/sealedmodels.test.ts`.

## Rules and pitfalls

- No imports: the scripts run it in plain Node (`--experimental-strip-types`).
