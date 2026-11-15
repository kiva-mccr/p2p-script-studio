# `src/lib/quotemarks.ts`

The open comments' quotes marked yellow in Write (RV-13), with CSS highlights (`comment`, and `comment-on` for the
card being read). Kept per field so that typing doesn't find every quote again on every key (PF-5).

- **Used by:** `screens/Write.svelte`. **Tests:** `tests/e2e/comments.spec.ts` (quotes marked; typing redoes only
  the field typed in).

## Rules and pitfalls

- `now()` when the comments, the columns drawn or the rows' order change; `soon()` when a quoted field's text changes
  (after a 0.4 s pause); `paint()` when only the card being read changes; `stop()` when Write goes.
- A field's marks are reused only while its `.shown` element, its first node and its text are all unchanged. The
  formatted text is `{@html}`, so a change puts in new nodes and the old marks would point at nodes no longer there.
- Marks are StaticRanges, not Ranges: the page keeps every live Range up to date on each change until the garbage
  collector takes it, and the speed check suspected old ones of slowing the switch to Review. A StaticRange in a highlight is drawn only while
  its nodes are still in the page. Tests read one's words through a Range (it has no `toString`).
- `stop()` drops a look still waiting for a pause: Review uses the same highlight names, and a late look from Write
  would put Write's marks over Review's.
- The row being typed in is focused, so its formatted text is hidden: waiting for the pause shows nothing stale.
