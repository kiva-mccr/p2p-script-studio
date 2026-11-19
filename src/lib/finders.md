# `src/lib/finders.ts`

Who finds or films each missing shot (AS-2, #211, board 88): `finders` reads the people on a "to find" note
(`Drone shot (to find: Ana, Sam)`), `withFinders` writes them, `bare` gives the note without them (so the same shot
given to different people is still one item).

- **Used by:** `lib/assets.ts`, `screens/Assets.svelte`. **Tests:** `tests/unit/finders.test.ts`,
  `tests/e2e/assets.spec.ts`, `tests/e2e/list.spec.ts`.

## Rules and pitfalls

- The people live inside the note's own brackets, so older apps (and exports) read it as a note as before: no new
  field in the script format.
- "(to film)" stays "(to film)"; a note with neither gains "(to find)" when someone is put on it; taking everyone off
  leaves "(to find)". A " (timeline)" mark at the end is kept.
- Names are compared ignoring case. A name typed in loses commas and brackets (they would end the list).
