# `src/lib/pasted.ts`

`pastedName`: the file name for a picture pasted into a row's Images & files with Ctrl+V (#304), "pasted 2026-11-18
21-14.png" in local time.

- **Used by:** `screens/FilesCell.svelte`. **Tests:** `tests/unit/pasted.test.ts`, `tests/e2e/shared.spec.ts`.

## Rules and pitfalls

- A screen grab on the clipboard is always called image.png, so the name says when it was pasted instead. Two in the
  same minute get " 2" from `addAsset`, like any copy.
- The extension follows the picture's type, not its name; an unknown type keeps its own extension.
