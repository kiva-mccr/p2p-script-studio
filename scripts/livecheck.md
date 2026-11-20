# `scripts/livecheck.ts`

The live check (SE-4): fetches https://p2p-script-studio.kivamccr.xyz/ as a browser would and fails if a security
header is missing or differs from `src/lib/headers.ts`, if the page carries a script that isn't the app's, or if
http:// doesn't redirect to https. Also the sealed file (SE-10) and the speech models (SE-5): one small file of each
model served at its pinned revision, and the models' zip at its release. And every file listed in `sha256sums.txt`
(SE-7) but the models, downloaded and hashed; the models' lines must match their pins. Run by `.github/workflows/live.yml` daily, after each deploy and by hand.

## Rules and pitfalls

- Plain Node 22 (`--experimental-strip-types`), no build: imports keep their `.ts` extension.
- Sends a browser's User-Agent and `accept: text/html`: Cloudflare only adds its analytics script for those.
- It checks the live site, so it never runs in pull requests (a PR can't change Cloudflare).
- Downloads the whole site but the models (about 90 files, a few MB) each run: `fetched` in `lib/livehashes.ts` leaves
  the models out, as they're hundreds of MB and pinned anyway.
