// The speech models served from the app (SE-5): the deploy downloads each model's files at the revision pinned in
// src/lib/models.lock.json, checks every file's SHA-256, and puts them in dist/models/<revision>/<model>/ for the
// website, and in one speech-models.zip for the sealed app (a release asset: too big for GitHub Pages' 100 MB a file).
//   node --experimental-strip-types scripts/models.ts          the deploy's step (needs Hugging Face)
//   node --experimental-strip-types scripts/models.ts --pin    prints a new lock for the models' latest revisions
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { zip } from '../src/lib/zip.ts';
import { MODELS_ZIP, modelsTag, type ModelsLock, type ModelsZip } from '../src/lib/modelfiles.ts';

const HF = 'https://huggingface.co';
const LOCK = 'src/lib/models.lock.json';
const CACHE = '.models-cache';
const REPO = 'https://github.com/kiva-mccr/p2p-script-studio';

// What each speech worker loads (speech.worker.ts, hear.worker.ts): the encoder in full, the decoder in q4 (WebGPU)
// and q8 (WebAssembly), and every small file at the top of the model.
const WANTED: Record<string, RegExp> = {
  'onnx-community/moonshine-base-ONNX': /^(onnx\/(encoder_model|decoder_model_merged_q4|decoder_model_merged_quantized)\.onnx|[^/]+\.(json|txt))$/,
  'onnx-community/whisper-base_timestamped': /^(onnx\/(encoder_model|decoder_model_merged_q4|decoder_model_merged_quantized)\.onnx|[^/]+\.(json|txt))$/,
};

const sha256 = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');

async function get(url: string): Promise<Uint8Array> {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return new Uint8Array(await res.arrayBuffer());
    if (attempt === 4 || res.status === 404) throw new Error(`${url}: ${res.status}`);
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
}

async function pin(): Promise<ModelsLock> {
  const lock: ModelsLock = {};
  for (const [model, wanted] of Object.entries(WANTED)) {
    const { sha } = JSON.parse(new TextDecoder().decode(await get(`${HF}/api/models/${model}`))) as { sha: string };
    const tree = JSON.parse(new TextDecoder().decode(await get(`${HF}/api/models/${model}/tree/${sha}?recursive=true`))) as
      { type: string; path: string; size: number; lfs?: { oid: string; size: number } }[];
    const files: ModelsLock[string]['files'] = {};
    for (const f of tree.filter((f) => f.type === 'file' && wanted.test(f.path))) {
      // A big file's SHA-256 is its Git LFS id; a small one is hashed here.
      files[f.path] = f.lfs ? { sha256: f.lfs.oid, bytes: f.lfs.size } : { sha256: sha256(await get(`${HF}/${model}/resolve/${sha}/${f.path}`)), bytes: f.size };
    }
    lock[model] = { revision: sha, files };
  }
  return lock;
}

async function fetchAll(lock: ModelsLock, dist: string): Promise<void> {
  const entries: { name: string; data: Uint8Array }[] = [];
  for (const [model, { revision, files }] of Object.entries(lock)) {
    for (const [path, { sha256: want }] of Object.entries(files)) {
      const kept = join(CACHE, revision, model, path);
      let data = existsSync(kept) ? new Uint8Array(readFileSync(kept)) : null;
      if (!data || sha256(data) !== want) {
        data = await get(`${HF}/${model}/resolve/${revision}/${path}`);
        if (sha256(data) !== want) throw new Error(`${model}/${path} isn't the pinned file (SHA-256 ${sha256(data)}, not ${want})`);
        mkdirSync(dirname(kept), { recursive: true });
        writeFileSync(kept, data);
      }
      const out = join(dist, 'models', revision, model, path);
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, data);
      entries.push({ name: `${model}/${path}`, data });
    }
  }
  // The same lock always makes the same zip, byte for byte (a fixed date): its release is made once.
  const bytes = new Uint8Array(await zip(entries, new Date(2026, 0, 1)).arrayBuffer());
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(join(CACHE, MODELS_ZIP), bytes);
  const tag = modelsTag(lock);
  const facts: ModelsZip = { tag, url: `${REPO}/releases/download/${tag}/${MODELS_ZIP}`, sha256: sha256(bytes).toUpperCase(), bytes: bytes.length };
  writeFileSync(join(dist, 'speech-models.json'), JSON.stringify(facts));
  console.log(`${entries.length} model files in dist/models; ${CACHE}/${MODELS_ZIP} (${Math.round(bytes.length / 1e6)} MB) for release ${tag}`);
}

if (process.argv.includes('--pin')) console.log(JSON.stringify(await pin(), null, 2));
else await fetchAll(JSON.parse(readFileSync(LOCK, 'utf8')) as ModelsLock, 'dist');
