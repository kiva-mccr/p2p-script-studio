# `src/lib/sealedruntime.ts`

In the sealed app only (SE-10): the page holds ONNX Runtime's WebAssembly once and posts a copy to each speech worker
as it is made (`{ type: 'sealed-runtime' }`); `lib/models.ts` sets it as `wasmBinary` before the first model loads.
`lib/sealed.ts` wraps the workers it builds into the page with `withRuntime`; the website never imports this file.

- **Used by:** the sealed build of `lib/listen.ts` and `lib/hear.ts`. **Tests:** none yet run a speech worker in the
  sealed file (no models there until SE-5).

## Rules and pitfalls

- `sealed-ort-wasm` is an alias set only in the sealed mode (vite.config.ts), to onnxruntime-web's own .wasm, the same
  file Transformers.js uses.
