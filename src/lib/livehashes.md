# `src/lib/livehashes.ts`

The list of the live files' SHA-256 (SE-7), `sha256sums.txt` beside the website: its name, how it's written and read
(`sha256sum`'s format), the models' lines checked against their pins, and which files the live check downloads.

- **Used by:** `scripts/hashes.ts` (the deploy), `scripts/livecheck.ts`. **Tests:** `tests/unit/livehashes.test.ts`.

## Rules and pitfalls

- No imports but types: the scripts run it in plain Node (`--experimental-strip-types`).
- Two spaces between hash and path, paths from the site's root with `/`: `sha256sum -c` and the PowerShell snippet in
  docs/security.md both rely on it.
