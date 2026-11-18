// The speech models' loader (SE-1), shared by Follow my voice (speech.worker.ts) and cuts on a word (hear.worker.ts).
// Transformers.js points ONNX Runtime at its WebAssembly on cdn.jsdelivr.net; the copy built into the app is used
// instead, so no code is ever loaded from another site (and the Content Security Policy, csp.ts, allows none).
import { env, pipeline as make } from '@huggingface/transformers';

const onnx = env.backends.onnx as { wasm?: { wasmPaths?: unknown } };
// No path at all: ONNX Runtime then uses its glue built into this worker and the .wasm file Vite put beside it.
if (onnx.wasm) onnx.wasm.wasmPaths = {};

// The sealed app (SE-10) has no .wasm beside it: the page hands the runtime over as the worker starts
// (lib/sealedruntime.ts), and nothing is made before it arrives.
const runtime = __SEALED__
  ? new Promise<void>((resolve) =>
      self.addEventListener('message', (e: MessageEvent) => {
        if (e.data?.type !== 'sealed-runtime') return;
        e.stopImmediatePropagation(); // not the worker's own message
        (onnx.wasm as { wasmBinary?: ArrayBuffer }).wasmBinary = e.data.wasm;
        resolve();
      }))
  : null;

const later = async (...args: unknown[]) => (await runtime, (make as (...a: unknown[]) => unknown)(...args));
export const pipeline = (runtime ? later : make) as typeof make;
