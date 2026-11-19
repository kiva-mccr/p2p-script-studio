# `src/lib/mp3.ts` and `src/lib/mp3.worker.ts`

The voice-over as an .mp3 (#237, EX-29, board 86): `encodeMp3` encodes the lined-up takes, with the gap between them,
as mono MPEG-1 layer III at 128 kbps (`KBPS`) and the takes' 48 kHz, with LAME (`@breezystack/lamejs`, an ES-module
copy of lamejs, LGPL-3.0). The worker runs it off the page; `mp3File` in `lib/voiceexport.ts` starts the worker.

- **Used by:** `lib/voiceexport.ts` (`mp3File`), `screens/Export.svelte`. **Tests:** `tests/unit/mp3.test.ts`,
  `tests/e2e/voice.spec.ts` (the saved file decodes as sound of the right length).

## Rules and pitfalls

- In a worker: lamejs does about 37 × real time here (1.6 s for a minute), so 13 minutes of takes would freeze the
  page for 20 s. The worker is made as `new Worker(new URL('./mp3.worker.ts', import.meta.url), { type: 'module' })`,
  the one way the sealed build (lib/sealed.md) can fold it in.
- The takes' samples are posted to the worker (copied); a newer setting stops the worker (`stale`).
- The preview plays the WAV (ready at once, timed to the sample); the .mp3 is the same takes, made in the background,
  and Save waits for it. LAME adds about 50 ms of silence at the start, too little to matter for the lit rows.
- Nothing is sent anywhere: the encoder ships with the app.
