// The sealed app (SE-10): the whole app as one HTML file, opened from the computer in Chrome or Edge, that can reach
// nothing but the folder it is given. A Vite plugin for `vite build --mode sealed` (vite.config.ts): workers are built
// into the page, every file becomes part of it, and its policy allows no network address at all, only the app's own
// script and stylesheet by their SHA-256.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Plugin } from 'vite';
import { policyOf, SEALED_FACTS, type SealedFacts } from './sealedfile';

export { SEALED_FILE } from './sealedfile';

/** The sealed file's fingerprint, size and policy (script-studio-sealed.json, for the Download sealed page). */
export function factsOf(page: string): SealedFacts {
  const bytes = Buffer.from(page, 'utf8');
  return { sha256: createHash('sha256').update(bytes).digest('hex').toUpperCase(), bytes: bytes.length, policy: policyOf(page) };
}

const sha256 = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

/** The sealed file's policy. No http(s) source anywhere: blob: and data: are the file's own pieces, made in the page. */
export function sealedPolicy(script: string, style: string): string {
  const p: Record<string, string[]> = {
    'default-src': ["'none'"],
    'script-src': [sha256(script), "'wasm-unsafe-eval'"], // the speech models run as WebAssembly
    'style-src': [sha256(style)],
    'style-src-attr': ["'unsafe-inline'"], // style="…" from Svelte and KaTeX, as on the website
    'img-src': ['blob:', 'data:'],
    'media-src': ['blob:', 'data:'],
    'font-src': ['data:'],
    'connect-src': ['blob:', 'data:'], // the file's own pieces (the example, the speech runtime), never a site
    'worker-src': ['blob:'], // the workers built into the page
    'object-src': ["'none'"],
    'base-uri': ["'none'"],
    'form-action': ["'none'"],
  };
  return Object.entries(p).map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}

/** `new Worker(new URL('./x.worker.ts', import.meta.url), …)` becomes a worker built into the page (Vite's ?worker&inline). */
export function inlineWorkers(code: string): string | null {
  const found: string[] = [];
  const out = code.replace(/new Worker\(new URL\('(\.\/[\w.-]+\.worker\.ts)', import\.meta\.url\), \{ type: 'module' \}\)/g, (_, path) => {
    found.push(path);
    return `__withRuntime(new __SealedWorker${found.length - 1}())`;
  });
  if (!found.length) return null;
  const imports = found.map((path, i) => `import __SealedWorker${i} from '${path}?worker&inline';\n`).join('');
  return `import { withRuntime as __withRuntime } from './sealedruntime';\n${imports}${out}`;
}

/** In the speech workers: ONNX Runtime's two references to its .wasm beside it become plain text, so the worker doesn't
 *  carry its own copy (two, in fact). The runtime gets the one in the page instead (lib/sealedruntime.ts). */
export function sealedWorker(): Plugin {
  return {
    name: 'studio-sealed-worker',
    enforce: 'pre',
    transform: (code, id) =>
      /onnxruntime-web\/dist\//.test(id) ? code.replaceAll('new URL("ort-wasm-simd-threaded.jsep.wasm",import.meta.url)', 'new URL("ort-wasm-simd-threaded.jsep.wasm","file:///sealed/")') : null,
  };
}

/** A script or stylesheet's text, made safe to sit inside a <script> or <style> tag. */
export function embeddable(text: string, tag: 'script' | 'style'): string {
  return text.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1').replace(/<!--/g, '<\\!--');
}

/** The built index.html with its one script and one stylesheet put inside it, and the sealed policy first in <head>. */
export function sealPage(html: string, read: (path: string) => string): string {
  let script = '';
  let style = '';
  let page = html
    .replace(/<script type="module" crossorigin src="\.\/([^"]+)"><\/script>/, (_, path) => `<script type="module">${(script = embeddable(read(path), 'script'))}</script>`)
    .replace(/<link rel="stylesheet" crossorigin href="\.\/([^"]+)">/, (_, path) => `<style>${(style = embeddable(read(path), 'style'))}</style>`);
  if (!script || !style || /\s(?:src|href)="\.\//.test(page)) throw new Error('sealed: index.html still names a file beside it');
  page = page.replace(/(<meta charset="utf-8" \/>)/, `$1\n    <meta http-equiv="Content-Security-Policy" content="${sealedPolicy(script, style)}" />\n    <meta name="referrer" content="no-referrer" />`);
  return page;
}

/** Build only, in the sealed mode: writes the one file to `out` once the build is on disk. */
export function sealed(out: string): Plugin {
  let dir = '';
  return {
    name: 'studio-sealed',
    apply: 'build',
    enforce: 'pre',
    configResolved: (c) => void (dir = c.build.outDir),
    transform: (code, id) => (/\/src\/lib\/(?!sealed)[\w.-]+\.ts$/.test(id) ? inlineWorkers(code) : null),
    closeBundle() {
      const page = sealPage(readFileSync(join(dir, 'index.html'), 'utf8'), (path) => readFileSync(join(dir, path), 'utf8'));
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, page);
      writeFileSync(join(dirname(out), SEALED_FACTS), JSON.stringify(factsOf(page)));
    },
  };
}
