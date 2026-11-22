# `src/lib/levelmeter.ts`

The sums for the live level beside "● Recording" (AU-11, board 97): `percent` (where a level in dBFS sits on the
bar), `zone` (too quiet, good, too loud) and `held` (the tick that holds the loudest moment for a second). Drawn by
`screens/LevelMeter.svelte`.

- **Used by:** `screens/LevelMeter.svelte`. **Tests:** `tests/unit/levelmeter.test.ts`, `tests/e2e/cleanup.spec.ts`.

## Rules and pitfalls

- The level is the mic's loudest sample of the last ~40 ms (`level` in `lib/voice.svelte.ts`), before any clean-up,
  so it says how you really sound. Grey under -30 dBFS, green to -6, red over.
- No words under it (the user, board 97): only the bar's colour says too quiet or too loud.
