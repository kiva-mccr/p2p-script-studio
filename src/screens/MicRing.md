# `src/screens/MicRing.svelte`

The mic on the script list with a ring round it (#241, board 90): green for rows recorded, pale red gaps for rows
still to record, in script order clockwise from 12 o'clock, sized by each row's words. The sums are
`lib/micring.ts`; the rows' takes come from the list's counts (`voice` in `lib/scriptlist.svelte.ts`).

- **Used by:** `List.svelte`. **Tests:** `tests/unit/micring.test.ts`, `tests/e2e/readtime.spec.ts`.

## Rules and pitfalls

- No takes yet: nothing is drawn. Every row recorded: a full green ring, labelled "recorded" (as the mic was before).
- A missing row's gap is at least 8% of the ring (`MIN_GAP`), so one short row still shows; recorded rows next to
  each other are one arc, so a long script doesn't turn into dashes.
- Outdated takes count as recorded (they are takes).
- SVG's arc can't draw a whole circle: a full run is drawn as a circle.
- Hover shows which rows are missing (the first six), from a `title` on a span round the SVG: an SVG `<title>` would
  add its words to the length cell's text.
