import { describe, expect, it } from 'vitest';
import { embeddable, factsOf, inlineWorkers, sealedPolicy, sealPage } from '../../src/lib/sealed';
import { policyOf, unsealed } from '../../src/lib/sealedfile';

// The sealed app (SE-10): one HTML file that can reach nothing but the folder it is given.
describe('the sealed file', () => {
  it('has a policy that names no site, only its own script and stylesheet by fingerprint', () => {
    const policy = sealedPolicy('code', 'css');
    expect(unsealed(policy)).toEqual([]);
    expect(policy).toMatch(/script-src 'sha256-[A-Za-z0-9+/=]+' 'wasm-unsafe-eval'/);
    expect(policy).toContain("connect-src blob: data:");
    expect(policy).not.toMatch(/https?:|'self'|\*/);
  });

  it('finds a site, a wildcard, or a missing lock in a policy', () => {
    expect(unsealed("default-src 'none'; connect-src https://huggingface.co; object-src 'none'; base-uri 'none'; form-action 'none'"))
      .toEqual(['connect-src allows https://huggingface.co']);
    expect(unsealed("default-src 'none'; img-src *; object-src 'none'; base-uri 'none'; form-action 'none'")).toEqual(['img-src allows *']);
    expect(unsealed("script-src 'self'")).toContain("no default-src 'none'");
    expect(unsealed('')).toEqual(['it has no policy']);
  });

  it('puts the script and stylesheet inside the page, policy first', () => {
    const html = [
      '<!doctype html><html><head>',
      '    <meta charset="utf-8" />',
      '    <script type="module" crossorigin src="./assets/index-A.js"></script>',
      '    <link rel="stylesheet" crossorigin href="./assets/style-B.css">',
      '</head><body></body></html>',
    ].join('\n');
    const files: Record<string, string> = { 'assets/index-A.js': 'let a = "</script>";', 'assets/style-B.css': 'p{color:red}' };
    const page = sealPage(html, (path) => files[path]);
    expect(page).toContain('<script type="module">let a = "<\\/script>";</script>');
    expect(page).toContain('<style>p{color:red}</style>');
    expect(page).not.toMatch(/\s(src|href)="\.\//);
    expect(page.indexOf('Content-Security-Policy')).toBeLessThan(page.indexOf('<script'));
    expect(unsealed(policyOf(page))).toEqual([]);
    const facts = factsOf(page);
    expect(facts.sha256).toMatch(/^[0-9A-F]{64}$/);
    expect(facts.policy).toBe(policyOf(page));
  });

  it('refuses a page that still names a file beside it', () => {
    const html = '<meta charset="utf-8" />\n<script type="module" crossorigin src="./assets/a.js"></script>\n<link rel="stylesheet" crossorigin href="./assets/b.css">\n<img src="./x.png">';
    expect(() => sealPage(html, () => 'x')).toThrow(/names a file beside it/);
  });

  it('builds the speech workers into the page, each handed the runtime', () => {
    const code = "const w = new Worker(new URL('./hear.worker.ts', import.meta.url), { type: 'module' });";
    const out = inlineWorkers(code)!;
    expect(out).toContain("import __SealedWorker0 from './hear.worker.ts?worker&inline';");
    expect(out).toContain('const w = __withRuntime(new __SealedWorker0());');
    expect(inlineWorkers('const a = 1;')).toBeNull();
  });

  it('keeps a script or stylesheet from closing its tag early', () => {
    expect(embeddable('a</SCRIPT>b<!--c', 'script')).toBe('a<\\/SCRIPT>b<\\!--c');
    expect(embeddable('a</style>', 'style')).toBe('a<\\/style>');
  });
});
