# `src/screens/HelpMenu.svelte`

The ? at the right end of every top bar (SB-5, board 77; on every screen since issue #219): a menu with Feedback…
(starts Feedback mode, AP-48), See the example (issue #239, left out while in it), GitHub (with GitHub's mark, #232) and "Version: PR #176" (the live version, AP-28: links to its pull request, the title and time on hover).
These used to float in the bottom corners, over the script and the timeline's drawer. On the website it also has
Download sealed (SE-10); in the sealed app GitHub and the download go, and the version is plain text marked sealed.

- **Used by:** `screens/Header.svelte` (a script's bar), `screens/List.svelte`, `screens/Setup.svelte`,
  `screens/DownloadSealed.svelte`, `screens/Export.svelte`, `screens/Teleprompter.svelte`. `tone`: `main` on a screen
  of its own, `dim` behind a script's buttons (a touch dimmer until hovered), `dark` on the Teleprompter's black,
  where the menu opens upwards (its controls sit at the bottom). **Tests:** `tests/e2e/app.spec.ts`, `tests/e2e/feedback.spec.ts`, `tests/e2e/tour.spec.ts`.

## Rules and pitfalls

- Feedback mode itself stays in `Feedback.svelte`, mounted once by App: the menu only raises `feedback.asked`
  (`lib/help.svelte.ts`). Mounted inside a top bar, its strip and panel would vanish when the bar changes.
- Closes on a press outside it, on Esc, and when an item is chosen.
- The tour's ? step (AP-53) holds the menu open through `feedback.tour === 'menu'`, beside its own `open`; a click
  away closes only `open`, so the tour keeps it shown until the step is left.
- See the example only raises `example.asked` (`lib/help.svelte.ts`); App opens it, dropping the script's address
  first, or the example would try to open your script's path inside itself.
