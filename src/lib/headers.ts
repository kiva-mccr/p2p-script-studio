// The security headers the live site sends (SE-4). GitHub Pages can't send headers, so Cloudflare adds them, from a
// response header rule for p2p-script-studio.kivamccr.xyz; this list is the one to keep it to. The daily live check
// (scripts/livecheck.ts) fails when the live site sends anything else.

import { policy } from './csp.ts'; // with .ts: scripts/livecheck.ts runs in plain Node

export const SITE = 'https://p2p-script-studio.kivamccr.xyz/';

export const HEADERS: Record<string, string> = {
  // The same policy as the page's <meta> tag, plus what only a header can say: no site may show the app in a frame.
  'content-security-policy': `${policy()}; frame-ancestors 'none'`,
  'strict-transport-security': 'max-age=31536000', // this subdomain only, never the rest of kivamccr.xyz
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  // Only the microphone (voice-over takes, Follow my voice), and only for the app itself.
  'permissions-policy': 'microphone=(self), camera=(), geolocation=(), payment=(), usb=(), serial=(), hid=(), midi=()',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
};

/** What's wrong with a response's headers, one line each; none when they match. */
export function headerProblems(got: Headers): string[] {
  return Object.entries(HEADERS).flatMap(([name, want]) => {
    const value = got.get(name);
    if (value === null) return [`${name} is missing`];
    return value === want ? [] : [`${name} is "${value}", expected "${want}"`];
  });
}

/** Script tags in the page that aren't the app's own (a host or a proxy adding its own, such as an analytics beacon). */
export function strangerScripts(html: string): string[] {
  return [...html.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]).filter((tag) => !/\ssrc="\.\/assets\/[^"/]+\.js"/.test(tag));
}

/** The app's own scripts and stylesheets that have no integrity hash (SE-9): every one should. */
export function unhashed(html: string): string[] {
  return [...html.matchAll(/<(?:script|link)\b[^>]*\s(?:src|href)="\.\/assets\/[^"]+\.(?:js|css)"[^>]*>/gi)]
    .map((m) => m[0]).filter((tag) => !/\sintegrity="sha384-/.test(tag));
}
