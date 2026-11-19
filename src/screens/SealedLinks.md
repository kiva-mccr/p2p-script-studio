# `src/screens/SealedLinks.svelte`

In the sealed app only (SE-10): a click on a link to a website (a script's link, a file's link) copies the address with
a note instead of opening it, so the sealed app never opens anything outside the folder.

- **Used by:** `App.svelte` (when `__SEALED__`). **Tests:** none open a script in the sealed file (no fake folder works
  on file://, `tests/e2e/folder.ts` needs private storage).

## Rules and pitfalls

- One listener on the document, capture phase, for click and middle click: links are made in many places.
- The app's own links (`#/…`) are left alone: they look like http links when the file is served from a site (as in tests).
