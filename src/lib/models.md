# `src/lib/models.ts`

The speech models' loader (SE-1), imported by `speech.worker.ts` (Follow my voice) and `hear.worker.ts` (cuts on a
word) instead of Transformers.js's own `pipeline`.

- **Used by:** both speech workers. **Tests:** none run the real model here (no Hugging Face); the stand-ins are in
  `tests/e2e/heard.spec.ts` and `teleprompter.spec.ts`.

## Rules and pitfalls

- In the sealed app (SE-10) there's no .wasm beside the page: `pipeline` waits for the page to hand the runtime over
  (`lib/sealedruntime.ts`) and uses it as `wasmBinary`.

- Transformers.js sets ONNX Runtime's `wasmPaths` to cdn.jsdelivr.net when it loads, so the runtime's code and
  WebAssembly came from a CDN at run time. Setting `wasmPaths` to `{}` (no prefix, no file) makes the runtime use the
  glue built into the worker and the `.wasm` Vite emitted beside it, from this site. Seen working under the policy in
  test Chromium with a tiny session (before the fix, the CDN import was refused).
- Keep it set before the first `pipeline()` call: the runtime reads it once, when it starts.
- Models still come from Hugging Face (allowed by the policy for downloads only).
