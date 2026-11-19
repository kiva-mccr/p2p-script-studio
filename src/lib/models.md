# `src/lib/models.ts`

The speech models' loader (SE-1, SE-5), imported by `speech.worker.ts` (Follow my voice) and `hear.worker.ts` (cuts on
a word) instead of Transformers.js's own `pipeline`. Everything comes from the app: the runtime's WebAssembly and the
models, pinned in `models.lock.json` and put beside the site by the deploy (`scripts/models.ts`).

- **Used by:** both speech workers. **Tests:** none run the real model here (no Hugging Face); the stand-ins are in
  `tests/e2e/heard.spec.ts` and `teleprompter.spec.ts`.

## Rules and pitfalls

- Never Hugging Face (`allowRemoteModels = false`; the policy no longer allows it either). The website reads
  `models/<revision>/<model>/…` beside it: a new pin is a new address, so a browser's kept copy is never mixed in.
- `npm run build` doesn't fetch the models (only the deploy can reach Hugging Face): in tests and `npm run preview`
  the model files are missing, and the stand-ins replace the workers anyway.
- In the sealed app (SE-10) there's nothing beside the page: `pipeline` waits for the page to hand over the runtime
  (as `wasmBinary`) and the models' zip added in Settings (`lib/sealedmodels.ts`), and Transformers.js reads each file
  through `customCache` as a slice of the zip. With no zip added, a model fails to load (the speech screens say so).
- Transformers.js sets ONNX Runtime's `wasmPaths` to cdn.jsdelivr.net when it loads. Setting `wasmPaths` to `{}` makes
  the runtime use the glue built into the worker and the `.wasm` Vite emitted beside it, from this site. Keep it set
  before the first `pipeline()` call: the runtime reads it once, when it starts.
- Whisper's q4 decoder (124 MB) is over GitHub Pages' 100 MB a file: Whisper uses q8 on WebGPU too (`hear.worker.ts`).
  A model file over 100 MB can't be served from the site: check sizes when pinning.
