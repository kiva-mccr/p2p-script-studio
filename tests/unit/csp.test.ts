import { describe, expect, it } from 'vitest';
import { csp, cspTags, policy, POLICY } from '../../src/lib/csp';

describe('the Content Security Policy (SE-1)', () => {
  it('starts from nothing and lets scripts come only from this site', () => {
    expect(POLICY['default-src']).toEqual(["'none'"]);
    expect(POLICY['script-src']).toEqual(["'self'", "'wasm-unsafe-eval'"]);
    expect(POLICY['object-src']).toEqual(["'none'"]);
    expect(POLICY['base-uri']).toEqual(["'none'"]);
    expect(POLICY['form-action']).toEqual(["'none'"]);
  });

  it('never allows inline scripts, eval or any site but Hugging Face', () => {
    const text = policy();
    expect(text).not.toContain("'unsafe-eval'");
    expect(POLICY['script-src']).not.toContain("'unsafe-inline'");
    const sites = text.match(/https?:\/\/[^\s;]+/g);
    expect(sites).toEqual(['https://huggingface.co', 'https://*.hf.co']);
  });

  it('goes into the built page right after the charset, with no Referer', () => {
    const plugin = csp();
    expect(plugin.apply).toBe('build');
    const html = '<head>\n    <meta charset="utf-8" />\n    <title>x</title>';
    const out = (plugin.transformIndexHtml as (h: string) => string)(html);
    expect(out).toContain(`<meta charset="utf-8" />\n    ${cspTags()}`);
    expect(out).toContain('<meta name="referrer" content="no-referrer" />');
  });
});
