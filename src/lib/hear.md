# `src/lib/hear.ts` and `src/lib/hear.worker.ts`

Hearing a take's words for cuts on a word (SB-8): `hear` decodes a take to 16 kHz and asks a worker running Whisper
(`onnx-community/whisper-base_timestamped`, through transformers.js, `return_timestamps: 'word'`) when each word
starts. On the graphics card (WebGPU) where there is one, otherwise on WebAssembly.

- **Used by:** `lib/voice.svelte.ts` (`VoiceOver.hearAll`). **Tests:** `tests/e2e/heard.spec.ts` (with a stand-in),
  `tests/unit/timeline.test.ts` (`heardWords`).

## Rules and pitfalls

- Whisper, not Moonshine (Follow my voice): only Whisper gives word timings. The `_timestamped` export carries the
  cross attentions word timings need; a plain Whisper export fails with `return_timestamps: 'word'`.
- About 150 MB, downloaded once from Hugging Face and kept by the browser; no sound leaves the computer. Only takes of
  rows cut on a word are heard, so someone who never cuts never downloads it.
- One take at a time (`busy`); the worker is kept for the page. Takes over 30 s are heard in 30 s pieces.
- Tests can't download the model (no Hugging Face here): `window.studioHear`, when a test sets it, stands in for it.
  The real model and its timings on a real voice were never seen here.
