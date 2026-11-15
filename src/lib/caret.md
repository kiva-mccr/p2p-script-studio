# `src/lib/caret.ts`

Where a place in a text box's text is drawn (UX-7): `caretAt(box, index)` gives its top, left and line height from the
box's top left, as scrolled now. A hidden copy of the box (same width, font, padding and wrapping) with a mark there.

- **Used by:** `screens/TextField.svelte` (the formatting toolbar). **Tests:** `tests/e2e/format.spec.ts`.

## Rules and pitfalls

- The copy must wrap as the box does: `white-space: pre-wrap` and the box's own width and `overflow-wrap`; a style
  that changes wrapping must be in `COPIED`.
- An empty rest of text still needs a mark (a zero-width space), or the place at the very end has no box to measure.
