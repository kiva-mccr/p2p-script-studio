# `src/screens/VoicePreview.svelte`

Export > Voice-over's preview (EX-11, #237 on board 86): the joined file's player, and every row with its take's
waveform and length. While it plays, the row being heard is lit (pale blue, bold), scrolled into view, and its
waveform fills in blue up to the playhead. Click a row to hear the file from there.

- **Used by:** `screens/Export.svelte`, which makes the file and the lined-up clips. **Tests:** `tests/e2e/voice.spec.ts`.

## Rules and pitfalls

- Waveforms come from the clips already decoded at 48 kHz (`peaksOf`, `wavePath` from lib/waveform.ts), 60 bars a row,
  each take scaled to its own loudest moment. A row with no take, or one silent for its read time, is a flat line.
- The time is read every animation frame while playing (timeupdate alone moves the fill in jumps, 4 times a second).
- Nothing is lit before the first play (time 0, paused), in a pause between takes, or after the end.
- The filled part is a second copy of the waveform clipped with `clip-path: inset(…)` in a style attribute, which the
  policy allows (lib/csp.md); no <style> tags are made.
- Scrolling into view is `block: 'nearest'`, only when the lit row changes while playing, so a paused list stays put.
