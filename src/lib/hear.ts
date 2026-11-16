// Hearing a take's words (SB-8): Whisper, in a worker, says when each word of a take starts, so cuts on a word land
// where the word is really said. The model is downloaded once from Hugging Face and kept by the browser; no sound
// leaves the computer. One worker for the page, made the first time a take is heard.
import { decoder } from './voiceexport';

export type Heard = [string, number][]; // each word, with when it starts (seconds from the recording's start)

let worker: Worker | null = null;
let busy: Promise<unknown> = Promise.resolve();

function ask(audio: Float32Array): Promise<Heard> {
  worker ??= new Worker(new URL('./hear.worker.ts', import.meta.url), { type: 'module' });
  const w = worker;
  return new Promise((resolve, reject) => {
    w.onmessage = (e: MessageEvent<{ type: 'heard'; words: Heard } | { type: 'error' }>) =>
      e.data.type === 'heard' ? resolve(e.data.words) : reject(new Error('hearing failed'));
    w.onerror = () => ((worker = null), reject(new Error('hearing failed')));
    w.postMessage({ audio }, [audio.buffer]);
  });
}

// The words of a take's sound. Tests stand in for the model with `window.studioHear` (tests/e2e/heard.spec.ts).
export async function hear(sound: Blob): Promise<Heard> {
  const fake = (window as unknown as { studioHear?: (sound: Blob) => Promise<Heard> }).studioHear;
  if (fake) return fake(sound);
  const audio = await decoder(16000)(await sound.arrayBuffer());
  const next = busy.then(() => ask(audio));
  busy = next.catch(() => {});
  return next;
}
