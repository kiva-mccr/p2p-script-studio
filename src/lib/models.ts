// The speech models' loader (SE-1, SE-5), shared by Follow my voice (speech.worker.ts) and cuts on a word
// (hear.worker.ts). Everything comes from the app itself: ONNX Runtime's WebAssembly is the copy built into the app (not
// cdn.jsdelivr.net), and the models are the files the deploy pinned and put beside the website (models.lock.json), not
// Hugging Face. The sealed app (SE-10) gets both from the page instead (lib/sealedruntime.ts).
import { env, pipeline as make } from '@huggingface/transformers';
import lock from './models.lock.json';
import type { ModelsLock } from './modelfiles';

const onnx = env.backends.onnx as { wasm?: { wasmPaths?: unknown; wasmBinary?: ArrayBuffer } };
// No path at all: ONNX Runtime then uses its glue built into this worker and the .wasm file Vite put beside it.
if (onnx.wasm) onnx.wasm.wasmPaths = {};
env.allowRemoteModels = false; // never Hugging Face
env.allowLocalModels = true;

/** Where a model's files are read: models/<revision>/ beside the website (a new revision is a new address, so the
 *  browser's kept copy of an older one is never mixed in), or the sealed app's zip. */
function place(model: string) {
  const revision = (lock as ModelsLock)[model]?.revision ?? 'none';
  env.localModelPath = __SEALED__ ? 'sealed:/models/' : new URL(`../models/${revision}/`, self.location.href).href;
}

type Zip = { blob: Blob; index: Record<string, [number, number]> };

// The sealed app has nothing beside it: the page hands over the runtime and the speech models' zip (if added in
// Settings) as the worker starts, and nothing is made before they arrive.
const runtime = __SEALED__
  ? new Promise<void>((resolve) =>
      self.addEventListener('message', (e: MessageEvent<{ type: string; wasm: ArrayBuffer; models: Zip | null }>) => {
        if (e.data?.type !== 'sealed-runtime') return;
        e.stopImmediatePropagation(); // not the worker's own message
        onnx.wasm!.wasmBinary = e.data.wasm;
        const zip = e.data.models;
        env.useBrowserCache = false;
        env.useCustomCache = true;
        env.customCache = {
          // Transformers.js asks for "<localModelPath><model>/<file>": the zip's entries are named "<model>/<file>".
          match: async (key: string) => {
            const at = zip?.index[String(key).replace(/^sealed:\/models\//, '')];
            return at ? new Response(zip!.blob.slice(at[0], at[0] + at[1])) : undefined;
          },
          put: async () => {},
        };
        resolve();
      }))
  : null;

export const pipeline = (async (task: string, model: string, options: object) => {
  await runtime;
  place(model);
  return (make as (...a: unknown[]) => unknown)(task, model, options);
}) as unknown as typeof make;
