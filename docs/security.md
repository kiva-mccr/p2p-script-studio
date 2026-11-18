# Security plan

Issue #267 (asked by the user, 2026-11-18): 100/100 on MDN's HTTP Observatory, OWASP's checks, and an easy way for
the team's IT to see that nothing the team writes leaves their computers. Steps are in ROADMAP.md (SE-…).

## Where we are

The app is a static page: no server, no database, no sign-in, and scripts never leave the team's folder. SE-1 adds a
Content Security Policy (`src/lib/csp.ts`), so the browser enforces that:

- Scripts run only from the app's own site (plus WebAssembly for the speech models): no inline scripts, no `eval`,
  no plugins.
- The page can only connect to its own site and Hugging Face (speech model downloads). Anything else is refused.
- No forms can be sent anywhere; links out send no Referer.
- Every e2e test fails if a feature breaks the policy (`tests/e2e/base.ts`).

Found while doing SE-1: when a speech model started, ONNX Runtime's code and WebAssembly were loaded from
cdn.jsdelivr.net. They now come from the app's own files (`src/lib/models.ts`).

Opening a script with cuts on a word (the example has some) downloads Whisper's files from Hugging Face by itself.
Hugging Face sees the computer's IP address and which model, never the script or the sound.

## Why 100/100 needs headers

GitHub Pages can't send custom response headers; the live site sent none (checked 2026-11-18). A `<meta>` policy
can't carry `frame-ancestors`. On GitHub Pages alone, HSTS (-20), X-Frame-Options / frame-ancestors (-20) and
X-Content-Type-Options (-5) are lost: about 55 at best.

## Steps

1. **SE-1** Content Security Policy (meta tag), runtime from the app, every e2e test checks the policy. Done.
2. **SE-2** Supply chain: Dependabot alerts and updates, CodeQL, secret scanning with push protection, Actions
   pinned to commit hashes, `npm audit --omit=dev` in Tests, OpenSSF Scorecard. Today's audit: KaTeX (fixed in
   0.19) and sharp (Node only, never shipped to browsers).
3. **SE-3** Untrusted script files: review every place script text becomes HTML (formatting, links, equations,
   previews); tests that try to sneak in a script, a `javascript:` link or an `onerror` attribute (OWASP ASVS V5).
4. **SE-4** Security headers. Done 2026-11-18, through Cloudflare (D1); COEP waits for SE-5: HSTS, `frame-ancestors 'none'`, nosniff, Referrer-Policy, a
   Permissions-Policy allowing only the microphone, the policy as a header, COOP/COEP (lets the speech models use
   every core). A daily GitHub check fetches the live site and fails if a header is missing; the expected list is in
   the repo.
   **SE-9** (asked by the user) Integrity hashes on the app's own script and stylesheet. Done 2026-11-18.
5. **SE-5** Speech models served from the app (D2, agreed by the user 2026-11-18, built when there's room): the deploy
   downloads pinned model files from Hugging Face, checks their SHA-256 and publishes them with the app (never in
   the repo). The policy then becomes `connect-src 'self'`.
6. **SE-6** Offline app (PWA): a service worker keeps the app (and the models after SE-5) on the computer.
7. **SE-7** Proof of what's running: GitHub build attestations and a published list of the live files' SHA-256.
8. **SE-8** IT pack: `SECURITY.md`, a "For IT" page (data flow, permissions, network addresses, what the browser
   keeps, how to check it), an OWASP ASVS level 1 map, and the Edge/Chrome policies IT can set.

## Decisions

- **D1, hosting.** Picked by the user, 2026-11-18, and done: GitHub Pages with Cloudflare's free plan in front (DNS
  moved from Hostinger to Cloudflare; one response-header rule; turning the subdomain's proxy off undoes it).
  Cloudflare Pages was the first idea, dropped because it caps files at 25 MB and SE-5's model files are larger
  (GitHub Pages allows 100 MB).
- **D2, models served from the app.** Agreed by the user, 2026-11-18.

## What the user can run and send back

MDN HTTP Observatory on the live site (after SE-1 and again after SE-4), an OWASP ZAP baseline scan
(`zap-baseline.py -t https://p2p-script-studio.kivamccr.xyz/`), and any scan IT uses.
