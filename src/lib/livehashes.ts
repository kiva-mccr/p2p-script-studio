// The live files' fingerprints (SE-7): every file the deploy publishes, with its SHA-256, in sha256sums.txt beside the
// website. Signed by the deploy's build attestation, so anyone can check that what the site serves is what GitHub
// built from this repo. Shared by the deploy's script (scripts/hashes.ts) and the live check: no Node or browser imports.
import type { ModelsLock } from './modelfiles.ts';

/** Beside the website, in the format `sha256sum -c` reads: "<hex>  <path from the site's root>" a line. */
export const HASHES_FILE = 'sha256sums.txt';

/** The list's text: sorted by path, so the same files always make the same bytes. */
export function hashList(files: Record<string, string>): string {
  return Object.keys(files).sort().map((path) => `${files[path]}  ${path}\n`).join('');
}

/** Path → SHA-256 from the list's text; a line that isn't "<64 hex>  <path>" is left out. */
export function readHashList(text: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const m = /^([0-9a-f]{64}) [ *](.+)$/.exec(line.trim());
    if (m) files[m[2]] = m[1];
  }
  return files;
}

/** The speech models' files are pinned (models.lock.json): the list must name each one, at its pinned hash. */
export function modelProblems(files: Record<string, string>, lock: ModelsLock): string[] {
  const problems: string[] = [];
  for (const [model, { revision, files: pinned }] of Object.entries(lock)) {
    for (const [path, { sha256 }] of Object.entries(pinned)) {
      const listed = files[`models/${revision}/${model}/${path}`];
      if (listed !== sha256) problems.push(`${model}/${path} is ${listed ? 'listed with another hash' : 'not listed'}`);
    }
  }
  return problems;
}

/** The files the live check downloads and hashes: all but the models (big, and checked against their pins). */
export const fetched = (files: Record<string, string>) => Object.keys(files).filter((p) => !p.startsWith('models/'));
