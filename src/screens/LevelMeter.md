# `src/screens/LevelMeter.svelte`

The live level beside "● Recording" in a row of Write (AU-11, board 97). It reads `voice.level()` every frame while
shown; the sums are `lib/levelmeter.ts`.

- **Used by:** `WriteRow.svelte`. **Tests:** `tests/e2e/cleanup.spec.ts`.

## Rules and pitfalls

- Shown only once the cue's ring has filled (while "Getting ready…" there's none), so it starts with the reading.
- `level` gives null when the recording has no level (tests' fake recordings without one): the bar stays empty.
- Its colours are fixed, not the theme's: grey, green and red must stay told apart by lightness too.
