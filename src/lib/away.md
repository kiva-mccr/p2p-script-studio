# `src/lib/away.ts`

Away (PF-14): `Away.away` is true once this tab has had no mouse, key, scroll or touch for 2 minutes and nothing is
playing. The Editor then skips its 5 s check and its "… is editing" file, so an away computer makes no folder calls;
the first touch calls `onBack` (the Editor rejoins with `file.back()` and checks at once).

- **Used by:** `screens/Editor.svelte`. **Tests:** `tests/unit/away.test.ts`, `tests/e2e/away.spec.ts`.

## Rules and pitfalls

- No timer of its own: being away is worked out when asked (`away`), by the Editor's 5 s and 30 s timers.
- `busy` (playing the script, a take playing or recording, the teleprompter open) counts as a touch whenever `away` is
  asked, so it is never away while it lasts, and the 2 minutes start from its end (within one 5 s check).
- Listeners are on `window` in the capture phase and passive, so nothing in the page can stop them and scrolling isn't
  slowed. `scroll` doesn't bubble, hence capture (Write's columns scroll on their own).
- A tab in the background gets no touches, so it goes away 2 minutes after it was hidden; coming back to it counts as a
  touch (the Editor's `visibilitychange`).
- `away-after` in this browser's storage shortens the 2 minutes, for tests.
- Back from away, the person rejoins as the newest here (`Saving.back` resets `since`): a keeper who took over meanwhile
  keeps script.md, so two computers never both think they are keeper.
