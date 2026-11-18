import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { execSync } from 'node:child_process';
import { parseMerge } from './src/lib/version';
import { marks } from './src/lib/marks';
import { csp } from './src/lib/csp';
import { sri } from './src/lib/sri';
import { sealed, sealedWorker, SEALED_FILE } from './src/lib/sealed';
import { fileURLToPath } from 'node:url';

// The live version (AP-28): only the deploy build (LIVE_BUILD, set in deploy.yml) reads the merge commit.
function liveVersion() {
  if (!process.env.LIVE_BUILD) return null;
  const [message, at] = execSync('git log -1 --format=%B%x00%cI', { encoding: 'utf8' }).split('\0');
  return parseMerge(message, at.trim());
}

// Served at https://p2p-script-studio.kivamccr.xyz/ (custom domain) and, until that redirects, at
// https://kiva-mccr.github.io/Internal-Script-Studio/. Relative paths work at both.
export default defineConfig(({ mode }) => {
  const define = { __VERSION__: JSON.stringify(liveVersion()), __SEALED__: JSON.stringify(mode === 'sealed') };
  // The sealed app (SE-10): `vite build --mode sealed` (after the website's build) adds one HTML file to dist/ that
  // holds the whole app, workers and files included, with a policy that reaches nothing but the picked folder.
  if (mode === 'sealed') {
    return {
      base: './',
      plugins: [sealed(`dist/${SEALED_FILE}`), marks(), svelte()],
      define,
      build: {
        outDir: 'node_modules/.sealed',
        emptyOutDir: true,
        assetsInlineLimit: () => true, // every file (fonts, the example, the speech runtime) inside the page
        cssCodeSplit: false,
        modulePreload: false,
        rolldownOptions: { output: { codeSplitting: false } },
      },
      resolve: { alias: [{ find: /^sealed-ort-wasm/, replacement: fileURLToPath(new URL('./node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.jsep.wasm', import.meta.url)) }] },
      worker: { format: 'es' as const, plugins: () => [sealedWorker()], rolldownOptions: { output: { codeSplitting: false } } },
    };
  }
  return {
    base: './',
    plugins: [marks(), svelte(), csp(), sri()], // marks: each element names its .svelte file, for feedback (AP-48)
    define,
    test: { include: ['tests/unit/**/*.test.ts'] },
  };
});
