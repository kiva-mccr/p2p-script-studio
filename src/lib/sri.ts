// Subresource Integrity (SE-9): the built index.html names a SHA-384 hash for each of the app's own scripts and
// stylesheets it loads, so the browser refuses a file that doesn't match what this build made (a file changed on the
// way, or by the host). A Vite plugin, run once the build is written.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export function integrity(content: string | Uint8Array): string {
  return 'sha384-' + createHash('sha384').update(content).digest('base64');
}

/** The page with `integrity="…"` on every <script src> and <link href> that points at one of `files` (by path). */
export function addIntegrity(html: string, files: Record<string, string | Uint8Array>): string {
  return html.replace(/<(script|link)\b([^>]*?)\s(src|href)="\.\/([^"]+)"([^>]*)>/g, (tag, name, before, attr, path, after) => {
    const file = files[path];
    if (file === undefined || /\sintegrity=/.test(tag)) return tag;
    return `<${name}${before} ${attr}="./${path}" integrity="${integrity(file)}"${after}>`;
  });
}

/** Build only, once every file is on disk: index.html is rewritten with the hashes of the files as written (Vite still
 *  changes chunks after index.html is made, so hashing them earlier gave wrong hashes and a blank page). */
export function sri(): Plugin {
  return {
    name: 'studio-sri',
    apply: 'build',
    writeBundle(options) {
      const dir = options.dir ?? 'dist';
      const page = join(dir, 'index.html');
      const html = readFileSync(page, 'utf8');
      const files: Record<string, Uint8Array> = {};
      for (const m of html.matchAll(/\s(?:src|href)="\.\/([^"]+)"/g)) {
        try {
          files[m[1]] = readFileSync(join(dir, m[1]));
        } catch {
          // not a file of this build: left without a hash
        }
      }
      writeFileSync(page, addIntegrity(html, files));
    },
  };
}
