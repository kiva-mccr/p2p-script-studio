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
   pinned to commit hashes, `npm audit --omit=dev` in Tests, OpenSSF Scorecard. Done 2026-11-20 (see below).
   Its audit found KaTeX (updated to 0.19.1) and sharp (Node only, never shipped to browsers; overridden to 0.35.5).
3. **SE-3** Untrusted script files: review every place script text becomes HTML (formatting, links, equations,
   previews); tests that try to sneak in a script, a `javascript:` link or an `onerror` attribute (OWASP ASVS V5).
   Done 2026-11-20. Every place reviewed: formatting (`toHtml` escapes all it doesn't make, links only http(s)),
   equations (KaTeX with `trust` off: `\href`, `\includegraphics`, `\html…` show as red text), the planning
   panel, History, Print, the teleprompter, Copy for Teams, the Fountain, Final Draft and FCP7 XML exports, links
   in Images & files, and opening a file from the folder. Fixed: `javascript:`/`data:`/`vbscript:` links in Images &
   files, `.html`/`.svg`/`.xml` files opening as pages at the app's own address (a blob: tab has the app's origin;
   they now download), and the unescaped status and version in Copy for Teams.
4. **SE-4** Security headers. Done 2026-11-18, through Cloudflare (D1); COEP waits for SE-5: HSTS, `frame-ancestors 'none'`, nosniff, Referrer-Policy, a
   Permissions-Policy allowing only the microphone, the policy as a header, COOP/COEP (lets the speech models use
   every core). A daily GitHub check fetches the live site and fails if a header is missing; the expected list is in
   the repo. It also checks that GitHub Pages' `Access-Control-Allow-Origin: *` stays removed (the one Medium
   finding in the user's ZAP scan, 2026-11-20; the same Cloudflare rule removes it).
   **SE-9** (asked by the user) Integrity hashes on the app's own script and stylesheet. Done 2026-11-18.
5. **SE-5** Speech models served from the app (D2, agreed by the user 2026-11-18, built when there's room): the deploy
   downloads pinned model files from Hugging Face, checks their SHA-256 and publishes them with the app (never in
   the repo). The policy then becomes `connect-src 'self'`. Done 2026-11-19 (models.lock.json, scripts/models.ts; the
   sealed app takes them as a zip in Settings).
6. **SE-6** Offline app (PWA): replaced by SE-10 (the user, 2026-11-18: the website, or a fully sealed file; no installed app).
   **SE-10** The sealed app: one HTML file whose policy names no address, built and attested by each deploy, offered on
   ? › Download sealed with five checks for IT. Done 2026-11-18; the speech models as its second file came with SE-5.
7. **SE-7** Proof of what's running (the sealed file's attestation is done with SE-10): GitHub build attestations and a
   published list of the live files' SHA-256. Done 2026-11-20 (see below).
8. **SE-8** IT pack: `SECURITY.md`, a "For IT" page (data flow, permissions, network addresses, what the browser
   keeps, how to check it), an OWASP ASVS level 1 map, and the Edge/Chrome policies IT can set. Done 2026-11-20:
   ? › For IT (docs/for-it.md), SECURITY.md, docs/asvs.md.

## SE-2: supply chain, how it works

- **Actions pinned.** Every `uses:` names a commit hash with its version as a comment
  (`actions/checkout@<40 hex> # v5.1.0`): a tag can be moved to other code, a hash can't. Dependabot updates both.
  Checkouts keep no token on disk (`persist-credentials: false`) and every workflow names its permissions.
  `tests/unit/supplychain.test.ts` fails on a new unpinned action. To pin one: `git ls-remote https://github.com/<owner>/<repo> 'refs/tags/<tag>' 'refs/tags/<tag>^{}'`
  (the `^{}` line, when there is one, is the commit).
- **Dependabot** (`.github/dependabot.yml`): routine updates once a month, one grouped pull request for npm and one for
  Actions, only for versions out a week. `@playwright/test` (pinned to the test container's Chromium) and TypeScript 7
  (not supported by svelte-check yet) are left out.
- **npm audit** in Tests checks only what ships to browsers (`--omit=dev`). A new advisory fails every pull request:
  update the package, or, when it never reaches the browser (like sharp, transformers.js's Node-only image library),
  pin a fixed version under `overrides` in package.json.
- **CodeQL** is GitHub's "Default setup" (Settings › Advanced Security), which already scans the app's TypeScript and
  the workflows on pull requests and pushes. A `codeql.yml` workflow was tried and removed (2026-11-20): GitHub refuses
  a workflow's results while Default setup is on, and Default setup needs nothing kept in the repo.
  **Scorecard** (`scorecard.yml`) rates the repo's habits weekly and after pushes; both report under Security › Code
  scanning, and Scorecard's results are public at scorecard.dev.
- **Repo settings** (only the owner can change them), Settings › Advanced Security (or Code security): Dependabot
  alerts, Dependabot security updates, Secret scanning with Push protection, and CodeQL's
  Default setup, all on.

## SE-7: checking what the site serves

Each deploy writes `sha256sums.txt` beside the website: the SHA-256 of every file it publishes (the page, its scripts,
styles and fonts, the sealed file, the speech models), in the format `sha256sum -c` reads. The same deploy signs it
with a build attestation (Sigstore), as it does the sealed file and the models' zip, so the list is proof that GitHub
built those exact files from this repo's code. The live check (`scripts/livecheck.ts`, daily and after each deploy)
downloads every file but the models and fails if one differs, which would also catch Cloudflare changing a file on the
way; the models' lines must match their pins (`src/lib/models.lock.json`).

The build is reproducible: on 2026-11-20 a build of main in a fresh container matched all 88 live files byte for byte.
So IT can also rebuild it themselves (`npm ci`, `LIVE_BUILD=1 npm run build`, then `cd dist && sha256sum -c` against
the live list, models aside, as those come from the deploy).

To check, with [GitHub's CLI](https://cli.github.com/) (any computer):

```sh
site=https://p2p-script-studio.kivamccr.xyz
curl -sO $site/sha256sums.txt
gh attestation verify sha256sums.txt -R kiva-mccr/p2p-script-studio   # signed by this repo's deploy
grep -v ' models/' sha256sums.txt | while read -r sum path; do
  [ "$(curl -s "$site/$path" | sha256sum | cut -d' ' -f1)" = "$sum" ] && echo "OK  $path" || echo "DIFFERENT  $path"
done
```

Or in Windows PowerShell (after `gh attestation verify` as above):

```powershell
$site = 'https://p2p-script-studio.kivamccr.xyz'
Invoke-WebRequest "$site/sha256sums.txt" -OutFile sha256sums.txt
Get-Content sha256sums.txt | Where-Object { $_ -notmatch '  models/' } | ForEach-Object {
  $sum, $path = $_ -split '  ', 2
  Invoke-WebRequest "$site/$path" -OutFile check.tmp
  if ((Get-FileHash check.tmp).Hash -eq $sum) { "OK  $path" } else { "DIFFERENT  $path" }
}
Remove-Item check.tmp
```

A browser only ever runs these files: the page's policy (SE-1) allows scripts from the site alone, and the page names
its own script and stylesheet with integrity hashes (SE-9), so a changed file is refused rather than run.

## Decisions

- **D1, hosting.** Picked by the user, 2026-11-18, and done: GitHub Pages with Cloudflare's free plan in front (DNS
  moved from Hostinger to Cloudflare; one response-header rule; turning the subdomain's proxy off undoes it).
  Cloudflare Pages was the first idea, dropped because it caps files at 25 MB and SE-5's model files are larger
  (GitHub Pages allows 100 MB).
- **D2, models served from the app.** Agreed by the user, 2026-11-18.

## What the user can run and send back

MDN HTTP Observatory on the live site (after SE-1 and again after SE-4), an OWASP ZAP baseline scan
(`zap-baseline.py -t https://p2p-script-studio.kivamccr.xyz/`), and any scan IT uses.
