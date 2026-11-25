# `src/lib/cleanup.svelte.ts`

Clean-up for voice-over takes (AU-4, board 31; AU-11, board 97): `cleaning` and `setCleaning` (the three switches in
Settings, kept in this browser), `measure` (where the speech is in a recording, how loud, and the ride that evens it
out inside the take), `rideAt` (the ride's gain at a moment) and `span` (what of a take to play, and how loud, as the
switches say).

- **Used by:** `lib/voice.svelte.ts` (measures each new take; `Sound`, `takeLength`, `wpm`), `lib/voiceexport.ts`
  (`cleaned`), `screens/Settings.svelte`, `screens/Write.svelte`. **Tests:** `tests/unit/cleanup.test.ts`,
  `tests/e2e/cleanup.spec.ts`.

## Rules and pitfalls

- Never cut the recording itself: the webm stays whole and the crop and gain are notes in the take's JSON, so a crop
  that cuts too much is undone by a switch (the user's choice over rewriting the file).
- Crop and loudness apply when played, to every take that was measured; noise reduction is Chrome's own while
  recording, so it only changes later takes. Takes from before AU-4 have no measure and play whole.
- `measure`: loudness every 10 ms; "loud" is a tenth of the voice's level (the loudest 5 %) and 4x the quietest tenth.
  Loud bits less than 0.25 s apart join up; a sound shorter than 0.15 s on its own (a click, a breath) isn't speech.
  Only the start and end are cut, with 0.25 s kept either side: pauses in the middle stay.
- Bug fixed: "loud" used to be 3x the room's noise, so in a real room hiss, breaths and rustles counted as speech and
  next to nothing was cropped (the tests' tones were silent between words). Keep a noisy-room test.
- Loudness is BS.1770's (K-weighted, 400 ms blocks, gated at -70 LUFS and 10 LU under), over the speech frames only,
  so pauses don't pull it down. The filters are worked out for the measuring rate (16 kHz in the app, 8 kHz in tests).
- The gain brings the speech to -16 LUFS, never pushes a sample (with the ride) past 0.89 (-1 dBFS), and stays between
  0.25 and 8. Peaks are found on the 16 kHz decode, so a real 48 kHz peak can be a little higher: exports clamp at 1.
- The ride (AU-11): a gain every 0.5 s (`RIDE`), each set by the speech within 1 s of it against the whole take,
  at most 6 dB either way, smoothed over three steps; a step with no speech near it holds the one before, so pauses
  are never raised on their own. Play (`Sound`) ramps the gain between steps; `cleaned` (joined WAV, .mp3, video,
  Resolve, waveforms) does the same per sample. "Even out the loudness" off turns gain and ride off together.
- Takes without a ride (from before AU-11) are measured again once a visit by `VoiceOver.levelAll` when the script
  opens, keeping who, when, the text and the heard words.
- Bug fixed (AU-11): takes started loud and faded. Chrome's auto gain was on (never asked off), and one gain per take
  kept the fade. Auto gain is now off in `openMic`; keep a fading-take test.
- Tuned on made-up tones in tests only: never tried on a real voice or a noisy room.
