# `src/lib/openfile.ts`

Opens a file from the script's folder (SE-3, docs/security.md): pictures, PDFs, text, video and sound in a new tab,
everything else downloaded under its own name. Used by Images & files (`FilesCell`), Assets, files from other scripts
(`SharedFiles`) and files on comments (`Attached`). **Tests:** `tests/unit/openfile.test.ts`,
`tests/e2e/untrusted.spec.ts`.

## Rules and pitfalls

- A blob: URL opened in a tab is a page at the app's own address. An `.html`, `.svg` or `.xml` file opened that way
  runs its scripts as the app (only the inherited policy stopped them; found by SE-3's tests). Never open a file in
  a tab unless its kind is in `SHOWN`; SVG downloads (its preview in the row is an `<img>`, which never runs scripts).
- The blob is made again with the type from `SHOWN`, so a page renamed `photo.png` opens as a broken picture, never
  as a page.
