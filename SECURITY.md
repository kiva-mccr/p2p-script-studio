# Security

## Reporting a vulnerability

Please report it privately: on this repository's **Security** tab, choose **Report a vulnerability**. Don't open a
public issue. You'll get an answer within 5 working days.

## Supported versions

Only the latest. The website (https://p2p-script-studio.kivamccr.xyz/) is always the latest version; a sealed file
is replaced by downloading it again from the website's ? › Download sealed.

## What the app is

A static page with no server, database or sign-in. Scripts stay in the team's own folder. For the data flow,
permissions, network addresses, what the browser keeps, how to check it and the browser policies IT can set, see
[For IT](docs/for-it.md), which is also in the app's ? menu.

## How fast fixes come

- A known vulnerability in a package the app ships fails every pull request (`npm audit --omit=dev` in Tests), so it's
  fixed before anything else changes. Dependabot opens a security update as soon as an advisory is published; the aim
  is to have it live within 7 days.
- Routine updates come monthly (`.github/dependabot.yml`), for versions out at least a week.
- A reported vulnerability in the app's own code: fixed within 30 days, or sooner for anything that could run code
  or reach a script.

## In place

- Content Security Policy and security headers, checked on the live site daily (`src/lib/csp.ts`, `src/lib/headers.ts`)
- Integrity hashes on the app's files; speech models pinned by SHA-256
- Actions pinned to commit hashes, Dependabot, CodeQL, secret scanning with push protection, OpenSSF Scorecard
- Build attestations and `sha256sums.txt`, a list of every live file's fingerprint ([how to check](docs/security.md))
- Tests that put scripts and `javascript:` links in every part of a script folder
- The OWASP ASVS 5.0 level 1 map: [docs/asvs.md](docs/asvs.md)
