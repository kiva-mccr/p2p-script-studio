# `src/lib/framing.ts`

Your own frame rate and size (#217, board 86): `readFps` and `readSide` check what was typed in a Custom box,
`frameRate` says how a rate is counted (NTSC or whole frames), `shapeName` names a size's shape ("4:5"). `OWN` is the
typed values' defaults.

- **Used by:** `lib/editxml.ts`, `lib/video.ts`, `screens/FrameChoices.svelte`. **Tests:** `tests/unit/framing.test.ts`,
  `tests/e2e/editexport.spec.ts`, `tests/e2e/video.spec.ts`.

## Rules and pitfalls

- The typed values are kept as strings, as typed: a box being typed in is never rewritten. Anything out of range
  (1 to 120 fps, 16 to 8192 pixels a side) is null, and the export's Save stays greyed while it is.
- 23.976, 29.97, 59.94 and 119.88 are NTSC (N × 1000/1001): timebase N with `ntsc` TRUE in the XML, and exactly
  N × 1000/1001 frames a second in the video. Allow 0.005 of slack, since people type 23.976 for 23.976023…
- FCP7 XML counts whole frames: another decimal (12.5) is written as its nearest whole rate (`rounded`), and the
  settings say so. The video uses the typed rate as it is.
