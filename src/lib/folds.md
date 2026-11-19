# `src/lib/folds.svelte.ts`

Which columns are folded away (AP-17 in Write, RV-23 in Review), and the grid's columns that follow from it.

- **Used by:** `Write.svelte` (`write-folded`), `Review.svelte` (`review-folded`), `FoldHeads.svelte`.
  **Tests:** `tests/e2e/editor.spec.ts`, `review.spec.ts`.

## Rules and pitfalls

- Each screen has its own key, so folding in Write never hides a column in Review (the user's choice, board 60).
- Kept in this browser through `recall`/`keep`, for every script; never in the script, so nothing syncs.
- A stored "all folded" (from an older build or a hand edit) opens Dialogue again.
- `folded` is replaced, never changed in place, so anything reading it redraws.
- Write's Speaker column (#221) folds under the key `speaker`, apart from the three: it never counts toward "the last
  one open", and `shut` counts only the three. `grid(…, true)` puts it after `lead` (120px, or the 28px strip).
