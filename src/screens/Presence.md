# `src/screens/Presence.svelte`

Who else is here, in the top bar (AP-37, board 62): "Sam is editing" (orange, as before, with the spinner while
their changes are folded in, FX-2), or when nobody else is editing, the last person here: "Sam · 12 min ago"
(grey ring), or with an amber ring when they stopped checking in without leaving (the hover says which). It was "Sam
was here 12 min ago" until the bar had to fit on one line at 1280 (the user, 2026-11-15). Either one is a
button that opens a list of everyone who opened the script in the last 30 days, newest first.

- **Used by:** `screens/Header.svelte`. **Tests:** `tests/e2e/conflict.spec.ts`, `tests/unit/editing.test.ts`.

## Rules and pitfalls

- The words come from `lib/editing.ts` (`editingText`, `lastHereText`, `seenWhen`); this file only shows them.
- "Now" is worked out again each time a new list comes in (the 5 s check), so "2 min ago" moves on by itself.
- The bar names someone only up to 7 days back; your own visits never show (matched by `fileName`).
- The list closes on Esc and on a click outside it, like the Header's menus; hovering the button gives the exact time.
