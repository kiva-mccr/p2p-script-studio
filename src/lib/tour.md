# `src/lib/tour.ts`

The guided tour in the example (AP-34, board 53): the steps of each tab's tour (`TOURS`), the "Your turn" words, and
what this browser remembers: which tabs' tours were seen, and Skip tour (no tab's tour plays by itself again).

- **Used by:** `screens/Tour.svelte`. **Tests:** `tests/e2e/tour.spec.ts`.

## Rules and pitfalls

- A step points at a part of the page by its `data-tour="…"` mark, never by a class or text. When a feature in the
  tour changes, moves or goes, change its step and its mark: `tour.spec.ts` plays every tour and fails when a
  step's part is gone or off screen.
- Keep each step to one sentence or two, and each tab to a handful: the user asked for a fast tour.
- Write may have 10 cards (8 agreed on board 66, AP-47; the ? menu and Feedback mode added by AP-53, issue #202);
  other tabs keep to 3 to 7.
- Every other e2e test starts with the tour skipped (`storageState` in `playwright.config.ts`), since it covers the page.
- A step with `unfold: true` (the timeline's, in Write and Review) opens the timeline's drawer: Tour.svelte sends a
  `tour-drawer` event (true on the step, false on leaving it or ending the tour) and Timeline.svelte folds it again
  only if the tour opened it, never touching `timeline-open`. The step is measured 0.2 s later, once it has slid open.
- A step with `show` (AP-53, issue #202) sets `feedback.tour` (lib/help.svelte.ts) for the step only: 'menu' holds
  the ? menu open (HelpMenu.svelte; the list is `data-tour-with="help"`, so the ring covers it), 'feedback' draws
  Feedback mode's strip and outline, inert (Feedback.svelte). Its part is drawn only once shown, so such a step is
  never left out for a missing part at the start.
- Feedback mode's step (issue #328, board 92) rings the orange outline itself (`data-tour="feedback"`), so the
  outlined row is lit, not dimmed; the outline sits under the tour (z-index 29) so the card is always on top, and the
  tour's blue ring is left off. The card stays above the strip (`data-tour-clear`), placed below or above the row.
- `show()` waits (the drawer sliding, the menu being drawn): a newer show, or finishing, makes a waiting one stop when
  it wakes. Without that, arrow keys pressed fast past the timeline's step ringed the timeline on a later step.
