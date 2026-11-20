// The live files' fingerprints (SE-7): the deploy's last step before the attestation writes dist/sha256sums.txt, the
// SHA-256 of every file it publishes (the website, the sealed file, the speech models).
//   node --experimental-strip-types scripts/hashes.ts
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HASHES_FILE, hashList } from '../src/lib/livehashes.ts';

/** Path (from `dir`, with /) → SHA-256 of every file under `dir`, except an old list. */
export function hashDir(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const full = join(entry.parentPath, entry.name);
    const path = relative(dir, full).split(sep).join('/');
    if (path !== HASHES_FILE) files[path] = createHash('sha256').update(readFileSync(full)).digest('hex');
  }
  return files;
}

// Run as a script (the deploy), not when a test imports hashDir.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = hashDir('dist');
  writeFileSync(join('dist', HASHES_FILE), hashList(files));
  console.log(`dist/${HASHES_FILE}: ${Object.keys(files).length} files`);
}
