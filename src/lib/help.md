# `src/lib/help.svelte.ts`

`feedback.asked`: a count that the ? menu (`screens/HelpMenu.svelte`) raises to start Feedback mode, which lives in
`screens/Feedback.svelte` (mounted once by `App.svelte`, so its strip and panel outlive the menu). Also `example`: See
the example (issue #239), a count the menu raises for `App.svelte` to open the example, and `open`, set by App while
the example is shown (the menu then leaves the item out).

- **Used by:** `screens/HelpMenu.svelte`, `screens/Feedback.svelte`, `App.svelte`. **Tests:** `tests/e2e/feedback.spec.ts`,
  `tests/e2e/example.spec.ts`.

## Rules and pitfalls

- A count, not a flag: asking twice in a row must start it twice (after a Cancel), and a flag left true would not
  change.
