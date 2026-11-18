# `src/lib/csp.ts`

The Content Security Policy (SE-1): a Vite plugin (in `vite.config.ts`) that puts the policy and
`<meta name="referrer" content="no-referrer">` into the built `index.html`, so the browser itself refuses anything the
app doesn't need: scripts only from this site, no plugins, no forms sent anywhere, and the page can only reach this
site and Hugging Face (the speech models).

- **Used by:** `vite.config.ts`. **Tests:** `tests/unit/csp.test.ts`, `tests/e2e/policy.spec.ts`, and every e2e test
  through `tests/e2e/base.ts` (a test fails if the page broke the policy).

## Rules and pitfalls

- A `<meta>` tag because GitHub Pages can't send headers. A meta policy can't hold `frame-ancestors`, `report-uri` or
  `sandbox`, and the browser only applies it from the tag on, so it must come before any script (right after charset).
- Build only (`apply: 'build'`): the dev server's hot reload runs inline scripts the policy would stop. The e2e tests
  run the build, so they run under the policy.
- A new feature that needs something refused (a site, `eval`, a `<style>` tag) fails the e2e tests with the browser's
  message. Add the narrowest source that works, say why beside it, and never `'unsafe-inline'` or `'unsafe-eval'` in
  `script-src`.
- `style-src-attr 'unsafe-inline'` stays: Svelte and KaTeX write `style="…"`. Stylesheets and `<style>` tags still only
  come from the app's own files.
- `connect-src data:`: the example's small files are built in as data: URLs and read with `fetch`.
- Hugging Face is allowed for downloads; the policy can't tell a download from an upload, so nothing in the app may
  send anything there (models only ever come down: `lib/models.ts`).
- Links to other sites (GitHub, a file's link) are navigations the user clicks, which the policy doesn't cover.
- A picture linked from another site is never loaded, so it has no preview anywhere (Write, Review, Print, Files):
  its link shows instead (the user's pick, 2026-11-18). `img-src` stays this site, blob: and data:.
