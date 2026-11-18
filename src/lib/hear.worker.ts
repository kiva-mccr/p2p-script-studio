// Whisper with word timings (SB-8), in a worker so the page stays smooth while a take is heard. On the graphics card
// (WebGPU) where there is one, otherwise on the processor (WebAssembly), as Follow my voice (speech.worker.ts).
// Whisper rather than Moonshine: only Whisper says when each word starts.
import type { AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { pipeline } from './models';

const MODEL = 'onnx-community/whisper-base_timestamped';
const DTYPE = {
  webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
  wasm: { encoder_model: 'fp32', decoder_model_merged: 'q8' },
};
type Out = { text: string; chunks?: { text: string; timestamp: [number, number | null] }[] };
type Hear = (audio: Float32Array, options: object) => Promise<Out | Out[]>;
let asr: Promise<Hear> | null = null;
const OPTIONS = { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 };

async function gpu() {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    return !!(await gpu?.requestAdapter());
  } catch {
    return false;
  }
}

async function make(device: 'webgpu' | 'wasm'): Promise<Hear> {
  // Typed loosely: the pipeline's own types are too large for the checker.
  const make = pipeline as unknown as (task: string, model: string, options: object) => Promise<AutomaticSpeechRecognitionPipeline>;
  return (await make('automatic-speech-recognition', MODEL, { dtype: DTYPE[device], device })) as unknown as Hear;
}

async function start(): Promise<Hear> {
  if (await gpu()) {
    try {
      const ready = await make('webgpu');
      await ready(new Float32Array(16000), OPTIONS); // a graphics card that can't run it fails here, not on a take
      return ready;
    } catch {
      // the processor takes over
    }
  }
  return make('wasm');
}

onmessage = async (event: MessageEvent<{ audio: Float32Array }>) => {
  try {
    const out = await (await (asr ??= start()))(event.data.audio, OPTIONS);
    const chunks = (Array.isArray(out) ? out : [out]).flatMap((o) => o.chunks ?? []);
    const words = chunks.map((c) => [c.text.trim(), Math.round(c.timestamp[0] * 100) / 100] as [string, number]).filter((w) => w[0]);
    postMessage({ type: 'heard', words });
  } catch {
    asr = null;
    postMessage({ type: 'error' });
  }
};
