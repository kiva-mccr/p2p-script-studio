# `src/lib/sealed.ts`

The sealed app (SE-10, board 89, asked by the user 2026-11-18): a Vite plugin for `vite build --mode sealed` that turns
the app into one HTML file, `dist/script-studio-sealed.html`, opened from the computer in Chrome or Edge. Its policy
(first tag in the file) allows no http or https source at all: its script and stylesheet only by SHA-256, and blob: and
data: for its own pieces. It writes `script-studio-sealed.json` beside it (fingerprint, size, policy) for the Download
sealed page. `npm run build` makes the website, then this; the deploy signs it with a build attestation.

- **Used by:** `vite.config.ts` (the `sealed` mode). **Tests:** `tests/unit/sealed.test.ts`, `tests/e2e/sealed.spec.ts`,
  and the daily live check (`scripts/livecheck.ts`: the file matches its fingerprint, its policy names no site).

## Rules and pitfalls

- Everything is in the page: `assetsInlineLimit` always, one chunk (`codeSplitting: false`), and each
  `new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })` in `src/lib` becomes Vite's
  `?worker&inline`. A worker written another way isn't caught: the build then names a file beside the page and fails.
- ONNX Runtime's .wasm (21 MB) was put in each speech worker twice (122 MB, over GitHub Pages' 100 MB). The workers'
  references to it are made inert (`sealedWorker`), and the page hands its one copy to each worker as it starts
  (`lib/sealedruntime.ts`, `lib/models.ts` waits for it). The file is about 36 MB.
- Chrome gives a file opened from the computer no private storage (OPFS): the example is left out of the sealed app.
- `</script` and `<!--` inside the inlined code are escaped (`<\/script`, `<\!--`), which is the same text in JS strings
  and regexes; a `String.raw` holding them would change (none does today).
- `__SEALED__` (vite.config.ts) is true only in this build: the ? menu, Feedback, links (`screens/SealedLinks.svelte`)
  and the first screen change with it.
