# `src/lib/commentsort.ts`

The order of the comment lists (RV-16, board 55): Line (the default), Time or Type. The switch is
`screens/SortSwitch.svelte`.

- **Used by:** `screens/ReviewComments.svelte`, `screens/Comments.svelte`. **Tests:** `tests/unit/commentsort.test.ts`,
  `tests/e2e/comments.spec.ts`.

## Rules and pitfalls

- Line: by row; within a row a comment on the whole row first, then comments on words in column order (Dialogue, On
  screen, Images & files) and by where the quote stands in the cell; a quote no longer found goes last in its cell.
  A deleted row's comments stay where the row was, after the row before it (RV-24, `after`, kept when reopened by
  hand); without it (deleted before RV-24) last of all. Ties keep `threads()`'s order (newest first).
- Time is `threads()`'s own order (newest first): nothing is sorted.
- Resolved ignores the switch (RV-25, board 81): `newestResolved`, by `done`, newest first. A card resolved by
  deleting its row is resolved at that save, so it is on top right after; its line place counts only once reopened.
  On hold and the open list still follow the switch.
- Type: suggestions, comments on words, comments on a whole row (the user's order), each in line order. Only the open
  list shows the headings with counts; On hold is sorted the same way without them.
- The choice is one `recall`/`keep` key (`comment-sort`) shared by Review and Write's Comments tab.
