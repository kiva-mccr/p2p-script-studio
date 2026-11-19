# `scripts/models.ts`

The speech models from the app (SE-5): in the deploy, downloads every file pinned in `src/lib/models.lock.json` from
Hugging Face, checks its SHA-256, and writes `dist/models/<revision>/<model>/…`, `dist/speech-models.json` and
`.models-cache/speech-models.zip` (a release asset, made once for each pin). `--pin` prints a new lock for the
models' latest revisions: run by hand from Actions ("Pin the speech models"), reviewed and committed.

## Rules and pitfalls

- This container can't reach Hugging Face: pinning and fetching only run in GitHub Actions.
- `WANTED` must match what the workers load (`speech.worker.ts`, `hear.worker.ts`): a file they ask for that isn't
  pinned is a 404 on the site and missing from the zip.
- No file over 100 MB (GitHub Pages refuses it): Whisper's q4 decoder is 124 MB, so it isn't pinned.
- The zip has a fixed date, so the same lock always makes the same bytes: an existing release stays right.
- `.models-cache/` is kept between deploys (actions/cache, keyed on the lock): Hugging Face is asked only after a new pin.
