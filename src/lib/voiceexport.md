# `src/lib/voiceexport.ts`

The voice-over as one file (EX-11, asked by the user for their work): `readClips` (each row's take, in row order,
decoded to mono), `lineUp` (with silence for rows with no take, EX-9), `wavFile` (one after another, as a 16-bit WAV),
`mp3File` (the same as an .mp3, made in a worker, #237, lib/mp3.md) and `wav` (one take as a WAV).

- **Used by:** `screens/Export.svelte`, `lib/editmedia.ts` (`decoder`, `cleaned`, `readTake`, `wav`). **Tests:** `tests/unit/voiceexport.test.ts`,
  `tests/e2e/voice.spec.ts`.

## Rules and pitfalls

- WAV, not webm: video editors don't take the browser's recordings.
- Decoding uses an `OfflineAudioContext` at the output rate: it needs no click and resamples every take to 48 kHz.
- A row with no take, or a take that can't be read, is left out (or silent, with `lineUp`'s `silence`); the export
  screen says how many.
- No gap between takes by default: the user asked for the takes joined. The export screen offers half a second.
- Each take is `cleaned` (cropped and made louder as set in Settings, AU-4) from its JSON, like Play plays it.
- `wavFile` works a slice (about 20 ms) at a time and pauses between, and never joins the takes into one big array
  first (PF-6): 150 takes (13 minutes) in one go froze the page for 0.7 s and held an extra 150 MB.
- Never tried on Chrome's real webm takes here: tests record a WAV.
