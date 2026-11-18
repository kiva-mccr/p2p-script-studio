# `src/screens/DownloadSealed.svelte`

Download sealed (SE-10, board 89): the website's page for the sealed app, from ? › Download sealed (`#download-sealed`,
App.svelte). What to download, the Download button (the file beside the site), and five standard checks for IT: the
SHA-256 with PowerShell's Get-FileHash, GitHub's signed build attestation (`gh attestation verify`), the policy (Google's
CSP Evaluator), watching it (DevTools Network, Process Monitor, Wireshark), and VirusTotal or Defender.

- **Used by:** `App.svelte`. **Tests:** `tests/e2e/sealed.spec.ts`.

## Rules and pitfalls

- The fingerprint, size and policy are read from `script-studio-sealed.json` at run time: the website is built before
  the sealed file, so it can't know them at build time. Missing (a dev build), the page says so in red.
- The page's own `a` colour would turn the blue Download button's text blue: `.get .primary` keeps it white.
- The speech models' choice comes with SE-5 (a second file); today the one choice is the app.
