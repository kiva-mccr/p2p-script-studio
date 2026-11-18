# `src/lib/sri.ts`

Subresource Integrity (SE-9, asked by the user 2026-11-18): a Vite plugin (in `vite.config.ts`) that adds
`integrity="sha384-…"` to each of the app's own scripts and stylesheets in the built `index.html`. The browser then
refuses a file that isn't byte for byte what this build made, whoever changed it on the way (host, proxy, CDN).

- **Used by:** `vite.config.ts`. **Tests:** `tests/unit/sri.test.ts`, `tests/e2e/policy.spec.ts` (a changed script is
  refused), and the daily live check (`lib/headers.ts` `unhashed`).

## Rules and pitfalls

- Hashes are made in `writeBundle`, from the files on disk. Hashing in `transformIndexHtml` (even `order: 'post'`) gave
  the wrong hash for the main script, because Vite still changes chunks after index.html is made: a blank page.
- Only the files index.html names are hashed. Chunks loaded later (`import()`, workers) aren't: the policy keeps them
  to this site.
- Never let Cloudflare change the files (Auto Minify, Rocket Loader stay off), or every visit gets a blank page.
- Build only. The dev server's files change on every save.
