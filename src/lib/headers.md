# `src/lib/headers.ts`

The security headers the live site sends (SE-4), and the checks the daily live check uses. GitHub Pages can't send
headers, so Cloudflare (in front of GitHub Pages for p2p-script-studio.kivamccr.xyz only) adds them with one response
header rule. This file is the list that rule must match.

- **Used by:** `scripts/livecheck.ts` (run by `.github/workflows/live.yml`). **Tests:** `tests/unit/headers.test.ts`.

## Rules and pitfalls

- Changing this file or the policy in `csp.ts` changes nothing live: the Cloudflare rule must be updated to match
  (Rules → Transform Rules → Modify response header, or the API with a zone token). Until then the live check fails.
- The policy header is the `<meta>` policy plus `frame-ancestors 'none'`. Both apply, so they must agree or the
  stricter one wins.
- HSTS is for this subdomain only (no `includeSubDomains`): the rest of kivamccr.xyz is a Hostinger site and email.
- `strangerScripts` exists because Cloudflare can add its own scripts to the page (Web Analytics did, 2026-11-18).
  The policy blocks them, but they mustn't be there.
- Imports `./csp.ts` with its extension, so Node can run the live check without a build.
