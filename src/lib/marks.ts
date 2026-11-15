// Feedback mode (AP-48): every element written in a .svelte file is marked with that file's name when the app is
// built (`data-c="WriteRow"`), so feedback on a clicked part names the file to open. A Vite plugin, run before Svelte.

import MagicString from 'magic-string';
import { parse } from 'svelte/compiler';
import type { Plugin } from 'vite';

type Node = { type?: string; name?: string; start?: number; [key: string]: unknown };

/** The file's text with ` data-c="Name"` added to each element (not inside an <svg>), or null if it can't be read. */
export function addMarks(code: string, name: string): { code: string; map: ReturnType<MagicString['generateMap']> } | null {
  let ast: { fragment: Node };
  try {
    ast = parse(code, { modern: true }) as unknown as { fragment: Node };
  } catch {
    return null;
  }
  const s = new MagicString(code);
  const walk = (node: unknown, inSvg: boolean) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, inSvg));
    const n = node as Node;
    let svg = inSvg;
    if (n.type === 'RegularElement' && typeof n.start === 'number' && n.name) {
      if (!inSvg) s.appendLeft(n.start + 1 + n.name.length, ` data-c="${name}"`);
      if (n.name === 'svg') svg = true;
    }
    for (const [key, value] of Object.entries(n)) {
      if (key === 'parent' || key === 'metadata' || key === 'attributes') continue;
      if (value && typeof value === 'object') walk(value, svg);
    }
  };
  walk(ast.fragment, false);
  return { code: s.toString(), map: s.generateMap({ hires: true, source: name }) };
}

/** The Vite plugin: marks the app's own .svelte files (under src/), never a package's. */
export function marks(): Plugin {
  return {
    name: 'feedback-marks',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0];
      if (!file.endsWith('.svelte') || file.includes('/node_modules/') || !file.includes('/src/')) return null;
      const name = file.split('/').pop()!.replace(/\.svelte$/, '');
      return addMarks(code, name);
    },
  };
}
