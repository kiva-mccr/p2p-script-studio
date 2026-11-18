import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { addIntegrity, integrity } from '../../src/lib/sri';

describe('the integrity hashes on the app\'s own files (SE-9)', () => {
  it('is the SHA-384 of the file, in base64', () => {
    expect(integrity('abc')).toBe('sha384-' + createHash('sha384').update('abc').digest('base64'));
  });

  it('stamps every script and stylesheet of the build, and nothing else', () => {
    const html = [
      '<script type="module" crossorigin src="./assets/index-A.js"></script>',
      '<link rel="stylesheet" crossorigin href="./assets/index-B.css">',
      '<link rel="icon" href="./favicon.svg">',
      '<a href="https://example.com/">x</a>',
    ].join('\n');
    const out = addIntegrity(html, { 'assets/index-A.js': 'js', 'assets/index-B.css': 'css' });
    expect(out).toContain(`<script type="module" crossorigin src="./assets/index-A.js" integrity="${integrity('js')}"></script>`);
    expect(out).toContain(`<link rel="stylesheet" crossorigin href="./assets/index-B.css" integrity="${integrity('css')}">`);
    expect(out).toContain('<link rel="icon" href="./favicon.svg">');
    expect(out).toContain('<a href="https://example.com/">x</a>');
    expect(addIntegrity(out, { 'assets/index-A.js': 'js', 'assets/index-B.css': 'css' })).toBe(out); // never twice
  });
});
