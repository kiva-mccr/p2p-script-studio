// The Content Security Policy (SE-1): the browser itself refuses anything the app doesn't need, so a script can only
// run from this site and the page can only reach this site (the speech models are served from it too, SE-5).
// Added to index.html as a <meta> tag when the app is built: GitHub Pages can't send headers. A Vite plugin.

import type { Plugin } from 'vite';

/** Each directive and what it allows. Anything not named falls back to default-src: nothing. */
export const POLICY: Record<string, string[]> = {
  'default-src': ["'none'"],
  'script-src': ["'self'", "'wasm-unsafe-eval'"], // the speech models run as WebAssembly
  'style-src': ["'self'"],
  'style-src-attr': ["'unsafe-inline'"], // style="…" from Svelte and KaTeX; never a <style> tag or a stylesheet
  'img-src': ["'self'", 'blob:', 'data:'], // pictures from the script's folder are blob: URLs
  'media-src': ["'self'", 'blob:'], // takes and video clips from the folder
  'font-src': ["'self'", 'data:'], // KaTeX's fonts, one inlined in its CSS
  'connect-src': ["'self'", 'blob:', 'data:'], // data: is the example's small files that Vite builds into the app
  'worker-src': ["'self'", 'blob:'],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
};

export function policy(p: Record<string, string[]> = POLICY): string {
  return Object.entries(p).map(([name, values]) => `${name} ${values.join(' ')}`).join('; ');
}

/** The tags put first in <head>: the policy, and no Referer sent with links to other sites. */
export function cspTags(): string {
  return `<meta http-equiv="Content-Security-Policy" content="${policy()}" />\n    <meta name="referrer" content="no-referrer" />`;
}

/** Build only: Vite's dev server runs inline scripts of its own (hot reload) that the policy would stop. */
export function csp(): Plugin {
  return {
    name: 'studio-csp',
    apply: 'build',
    transformIndexHtml: (html) => html.replace(/(<meta charset="utf-8" \/>)/, `$1\n    ${cspTags()}`),
  };
}
