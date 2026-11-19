# `src/screens/Contact.svelte`

One person's contact details (AP-31, board 50): Email and LinkedIn (agreed: no phone), shared by every script,
each with Copy and Write ↗ / Open ↗ (AP-55, board 88).

- **Used by:** `screens/Credits.svelte`, `screens/People.svelte`. **Tests:** `tests/e2e/credits.spec.ts`.

## Rules and pitfalls

- Done saves only when something changed (a new people file), then hands the person back with `onSaved`. The
  windows call `done()` before closing, so typed details aren't lost; it returns false (and shows why) on a failure.
- Copy and Write ↗ / Open ↗ (#224, AP-55) show only when the box has something in it; they use what's typed, not
  what's saved. The buttons' names ("Copy Email") contain the label's word, so tests find the boxes with
  `getByLabel('Email', { exact: true })`.
- The form starts from the person as they were when it opened; it isn't refreshed while open.
