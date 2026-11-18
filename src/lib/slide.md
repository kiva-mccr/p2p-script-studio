# `src/lib/slide.ts`

`grow` (issue #214): the in transition for something opening in the page (Svelte's `slide`, 0.18 s, eased), so the
page below moves down smoothly instead of jumping. On the new comment box and On hold / Resolved (`ReviewComments`,
`Comments`), the reply box (`CommentCard`), and the review note and rows (`Review`).

`slideAway`, the out transition for a comment card leaving its list (RV-19, the user's ask): it slides right and
fades, then its height closes so the cards below slide up. On the wrapper of each card in `ReviewComments.svelte` and
`Comments.svelte` (open, On hold and Resolved lists).

- **Used by:** `screens/ReviewComments.svelte`, `screens/Comments.svelte`, `screens/CommentCard.svelte`,
  `screens/Review.svelte`. **Tests:** `tests/e2e/hold.spec.ts`, `review.spec.ts` (#214).

## Rules and pitfalls

- Svelte runs it with the Web Animations API. With Playwright's `page.clock` paused it only moves while the test
  runs the clock, a frame at a time (one big `runFor` isn't enough): poll `runFor(100)` until the card is gone.
- The flex `gap` stays until the element is removed, so a negative bottom margin closes it too (no jump at the end).
- Reduced motion: no animation, the card goes (or `grow`'s comes) at once.
- `grow` is only `in:`, never `out:`: an out transition keeps the element in the page until it ends, which a test with
  a paused clock would wait on for ever. Closing stays instant.
- On a list (On hold, Resolved) it goes on one wrapper (`.group`, `gap: inherit`), so the list grows as one and the
  cards keep their own `out:slideAway`.
- Transitions are local: closing a dropdown, or leaving the tab, removes cards without it.
