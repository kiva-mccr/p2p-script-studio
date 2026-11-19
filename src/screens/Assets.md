# `src/screens/Assets.svelte`

The Assets tab (EX-6, board 12): every file, link and "still to find" note in the script, grouped by what needs
doing (missing, still to find, in the folder or linked) or by row under the section names. A row number goes to
that row in Write; a name opens the file or link. Each item still to find or film can be given to people
(`Finders.svelte`, AS-2, #211).

- **Used by:** `screens/Editor.svelte`. **Tests:** `tests/e2e/assets.spec.ts`.

## Rules and pitfalls

- Giving a shot to someone changes the Files line in every row that has it and calls `onChange`, so it saves, merges
  and gets History and Ctrl+Z like any edit. `script` is bound for that, as in Credits.

- It is given `missing` by the Editor, which keeps it up to date, so the list and the tab's count always agree.
- "Order" is remembered in this browser (`assets-order`).
- Thumbnails (AP-19) are pictures, TIFFs, a PDF's page 1 or a video's still (AP-39), never a player, from the folder, as blob URLs
  revoked when the list changes; one that won't draw or play is hidden. Sound and text get none here.
- Text after an `{#if}` loses its leading space in Svelte: the " · " separators are written as strings.
- Under "In the folder or linked" each file shows its first row's words (#212, `excerpt`), between its name and its
  row numbers; the name is capped at 40% so the words get room. They aren't in a control, so feedback mode covers them.
- A picture linked from another site is never shown (SE-1, the user's pick): only its link. See lib/csp.md.
