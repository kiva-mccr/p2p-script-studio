import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATABASES, LOCAL_KEYS, forIt, forItMarkdown, otherHosts, pieces, refused } from '../../src/lib/forit';
import { HEADERS } from '../../src/lib/headers';

// The For IT page (SE-8) has to say what the code does: these fail when the code and the page disagree.

function sources(dir = 'src'): { path: string; text: string }[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|svelte)$/.test(name) ? [{ path, text: readFileSync(path, 'utf8') }] : [];
  });
}
const all = sources().filter((f) => !f.path.endsWith('forit.ts')).map((f) => f.text).join('\n'); // the code, not the page
const text = (sealed: boolean) => JSON.stringify(forIt(sealed));

describe('the For IT page', () => {
  it('lists every IndexedDB database the app opens', () => {
    // Database names are 'script-studio' or 'script-studio-<word>' ('script-studio-sealed.html' doesn't match).
    const named = new Set([...all.matchAll(/'(script-studio(?:-[a-z]+)?)'/g)].map((m) => m[1]));
    expect([...named].sort()).toEqual(Object.keys(DATABASES).sort());
    for (const name of named) expect(text(true)).toContain(`IndexedDB ${name}`);
  });

  it('lists the website-only and sealed-only stores where they are used', () => {
    expect(text(false)).not.toContain('IndexedDB script-studio-models');
    expect(text(false)).toContain('Private file storage');
    expect(text(true)).not.toContain('Private file storage');
  });

  it('lists the localStorage keys that hold or name a script', () => {
    expect(all).toMatch(/#backupKey = `unsaved:\$\{/); // unsaved typing (lib/saving.svelte.ts)
    expect(all).toMatch(/`seen-\$\{tab\}:\$\{folder\}/); // tab counts (lib/tabcounts.ts)
    for (const key of Object.keys(LOCAL_KEYS)) expect(text(false)).toContain(`localStorage ${key}`);
  });

  it('names sessionStorage, the only other storage the app uses', () => {
    const keys = new Set([...all.matchAll(/sessionStorage\.\w+\('([^']+)'/g)].map((m) => m[1]));
    for (const key of keys) expect(text(false)).toContain(`sessionStorage ${key}`);
    expect(all).not.toMatch(/document\.cookie|caches\.open/);
  });

  it("takes the refused permissions from the site's header", () => {
    expect(refused('microphone=(self), camera=(), usb=()')).toEqual(['camera', 'USB']);
    for (const word of refused(HEADERS['permissions-policy'])) expect(text(false)).toContain(word);
  });

  it('lists every address the policy lets the page connect to', () => {
    expect(otherHosts({ 'connect-src': ["'self'", 'blob:', 'data:', 'https://example.org'] })).toEqual(['https://example.org']);
    expect(otherHosts()).toEqual([]); // today only the site itself: a new address must be shown on the page
  });

  it('turns `code` and [links](…) into pieces, and nothing else', () => {
    expect(pieces('Run `a` then [b](https://x.org) or [c](javascript:alert(1))')).toEqual([
      { text: 'Run ' }, { text: 'a', code: true }, { text: ' then ' }, { text: 'b', href: 'https://x.org' }, { text: ' or [c](javascript:alert(1))' },
    ]);
  });

  it('promises the answer time SECURITY.md promises', () => {
    expect(readFileSync('SECURITY.md', 'utf8')).toContain('5 working days');
    expect(text(false)).toContain('5 working days');
  });

  it('is the same as docs/for-it.md (UPDATE_DOCS=1 rewrites it)', () => {
    if (process.env.UPDATE_DOCS) writeFileSync('docs/for-it.md', forItMarkdown());
    expect(readFileSync('docs/for-it.md', 'utf8')).toBe(forItMarkdown());
  });
});
