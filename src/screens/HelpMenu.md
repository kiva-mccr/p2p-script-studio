# `src/screens/HelpMenu.svelte`

The ? at the right end of every top bar (SB-5, board 77): a menu with Feedback… (starts Feedback mode, AP-48),
GitHub and "Version: PR #176" (the live version, AP-28: links to its pull request, the title and time on hover).
These used to float in the bottom corners, over the script and the timeline's drawer.

- **Used by:** `screens/Header.svelte` (a script's bar), `screens/List.svelte`, `screens/Setup.svelte`.
  **Tests:** `tests/e2e/app.spec.ts`, `tests/e2e/feedback.spec.ts`.

## Rules and pitfalls

- Feedback mode itself stays in `Feedback.svelte`, mounted once by App: the menu only raises `feedback.asked`
  (`lib/help.svelte.ts`). Mounted inside a top bar, its strip and panel would vanish when the bar changes.
- Closes on a press outside it, on Esc, and when an item is chosen.
