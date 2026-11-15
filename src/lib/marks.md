# `src/lib/marks.ts`

Feedback mode (AP-48): a Vite plugin (in `vite.config.ts`, before Svelte) that adds `data-c="<file name>"` to every
element written in the app's own `.svelte` files, so feedback on a clicked part names the file to open
(`lib/feedback.ts` reads the closest `data-c`).

- **Used by:** `vite.config.ts`. **Tests:** `tests/unit/marks.test.ts`, `tests/e2e/feedback.spec.ts`.

## Rules and pitfalls

- Uses Svelte's own parser (`svelte/compiler` `parse`, modern AST) to find elements, never a regex: `{a < b}` in a
  template or `<` in a script would fool one. A file that won't parse is left as it is (Svelte then reports it).
- The attribute goes in straight after the tag name, with magic-string, so the source map still points at the file.
- Elements inside an `<svg>` aren't marked (the svg itself is): icons' paths would only add weight.
- Only files under `src/`, never a package's. Runs for dev, build and tests alike.
- The mark is on the element where it is written: markup passed as a snippet is marked with the file that wrote it.
