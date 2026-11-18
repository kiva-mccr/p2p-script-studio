// The sealed app's file on the website (SE-10): its name and the facts beside it. Shared by the build (lib/sealed.ts),
// the Download sealed page and the live check, so it holds nothing that needs Node or a browser.

/** The sealed file, in the website's own folder. */
export const SEALED_FILE = 'script-studio-sealed.html';
/** Beside it: its SHA-256 (hex, upper case, as PowerShell's Get-FileHash shows it), size and policy. */
export const SEALED_FACTS = 'script-studio-sealed.json';

export type SealedFacts = { sha256: string; bytes: number; policy: string };

/** A page's policy, read back from its <meta> tag. */
export function policyOf(page: string): string {
  return /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(page)?.[1] ?? '';
}

/** What's wrong with a sealed policy: any source that names a site, or a directive that isn't locked down. */
export function unsealed(policy: string): string[] {
  const problems: string[] = [];
  if (!policy) return ['it has no policy'];
  for (const part of policy.split(';').map((p) => p.trim()).filter(Boolean)) {
    const [name, ...values] = part.split(/\s+/);
    for (const v of values) if (!/^('none'|'self'|'wasm-unsafe-eval'|'unsafe-inline'|'sha256-[A-Za-z0-9+/=]+'|blob:|data:)$/.test(v)) problems.push(`${name} allows ${v}`);
    if (values.includes("'self'")) problems.push(`${name} allows 'self' (a file's folder)`);
    if (name === 'script-src' && values.includes("'unsafe-inline'")) problems.push("script-src allows 'unsafe-inline'");
  }
  for (const must of ["default-src 'none'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"])
    if (!policy.includes(must)) problems.push(`no ${must}`);
  return problems;
}
