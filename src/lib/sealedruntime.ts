// The sealed app's speech runtime (SE-10, SE-5, lib/sealed.ts): ONNX Runtime's WebAssembly is built into the page once,
// here, and handed to each speech worker as it starts with the speech models added in Settings (lib/sealedmodels.ts),
// instead of being fetched from beside the page (there is no beside). Only the sealed build imports this file:
// lib/sealed.ts wraps every worker it builds into the page with it.
import wasm from 'sealed-ort-wasm?url';
import { keptModels } from './sealedmodels';

let bytes: Promise<ArrayBuffer> | null = null;

export function withRuntime(worker: Worker): Worker {
  bytes ??= fetch(wasm).then((r) => r.arrayBuffer());
  void Promise.all([bytes, keptModels()]).then(([b, models]) =>
    worker.postMessage({ type: 'sealed-runtime', wasm: b.slice(0), models })); // a copy of the runtime for each worker
  return worker;
}
