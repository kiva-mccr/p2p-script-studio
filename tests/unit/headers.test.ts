import { describe, expect, it } from 'vitest';
import { policy } from '../../src/lib/csp';
import { HEADERS, headerProblems, strangerScripts } from '../../src/lib/headers';

describe('the live security headers (SE-4)', () => {
  it("send the page's own policy, plus frame-ancestors, which only a header can carry", () => {
    expect(HEADERS['content-security-policy']).toBe(`${policy()}; frame-ancestors 'none'`);
    expect(HEADERS['strict-transport-security']).not.toContain('includeSubDomains'); // the rest of the domain isn't ours to force
  });

  it('names each missing or different header', () => {
    expect(headerProblems(new Headers(HEADERS))).toEqual([]);
    const got = new Headers(HEADERS);
    got.delete('x-frame-options');
    got.set('referrer-policy', 'origin');
    expect(headerProblems(got)).toEqual(['x-frame-options is missing', 'referrer-policy is "origin", expected "no-referrer"']);
  });

  it("finds a script that isn't the app's own, such as an analytics beacon", () => {
    const ours = '<script type="module" crossorigin src="./assets/index-Cika5Cja.js"></script>';
    expect(strangerScripts(`<head>${ours}</head>`)).toEqual([]);
    const beacon = '<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="{}">';
    expect(strangerScripts(`<head>${ours}</head><body>${beacon}</script></body>`)).toEqual([beacon]);
    expect(strangerScripts('<script>alert(1)</script>')).toEqual(['<script>']);
  });
});
