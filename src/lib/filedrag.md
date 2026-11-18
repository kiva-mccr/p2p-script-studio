# `src/lib/filedrag.svelte.ts`

Files dragged in from Explorer (#262, board 81): `fileDrag.on` is true while files are over the page. Every row's
Images & files then shows a dashed outline, and the one under the pointer turns solid ("Drop to add to row 7").

- **Used by:** `screens/FilesCell.svelte`. **Tests:** `tests/e2e/shared.spec.ts` (drop files onto a row).

## Rules and pitfalls

- One listener on the window, added when the module is first imported. It only looks at drags carrying files
  (`types` has `Files`), never text or a row being moved.
- dragover keeps firing while files are over the page, even with the pointer still, so `on` turns off 250 ms after
  the last one: that covers leaving the window and Esc, which give no reliable event.
- Outside a drop target the drop is refused (`dropEffect = 'none'`), so a file dropped beside a row isn't opened by
  the browser in place of the app. A target that takes files calls `preventDefault` first (bubbling reaches the
  window after it), and is left alone.
