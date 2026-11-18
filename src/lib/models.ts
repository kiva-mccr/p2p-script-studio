// The speech models' loader (SE-1), shared by Follow my voice (speech.worker.ts) and cuts on a word (hear.worker.ts).
// Transformers.js points ONNX Runtime at its WebAssembly on cdn.jsdelivr.net; the copy built into the app is used
// instead, so no code is ever loaded from another site (and the Content Security Policy, csp.ts, allows none).
import { env, pipeline } from '@huggingface/transformers';

const onnx = env.backends.onnx as { wasm?: { wasmPaths?: unknown } };
// No path at all: ONNX Runtime then uses its glue built into this worker and the .wasm file Vite put beside it.
if (onnx.wasm) onnx.wasm.wasmPaths = {};

export { pipeline };
