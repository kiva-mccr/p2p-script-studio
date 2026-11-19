# `src/lib/micring.ts`

The sums for the ring round the mic on the script list (#241, board 90): `micRing` turns each row's words and
whether it has a take into the recorded arcs, and `ringLabel` says what's missing. Drawn by `screens/MicRing.svelte`.

- **Used by:** `screens/MicRing.svelte`, `lib/scriptlist.svelte.ts` (the `Voice` type). **Tests:**
  `tests/unit/micring.test.ts`.

## Rules and pitfalls

- `Voice` is one number per row, so a missing row's number is its place in the script: words (at least 1) when the
  row has a take, minus the words when it has none, 0 when it needs none. Kept small on purpose: it lives in
  localStorage and in every script's shared summary.
- The gaps get their size first (at least `MIN_GAP` each) and the recorded rows share what's left; only when the gaps
  alone pass the whole ring is everything scaled down together.
- Counts and summaries from before #241 have no `voice`: the list reads those scripts once more, then shows the ring.
