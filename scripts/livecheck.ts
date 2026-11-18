// The live check (SE-4): fetches the live site and fails if a security header is missing or different from
// src/lib/headers.ts, or if the page has a script that isn't the app's. Also the sealed file (SE-10): it must match the
// fingerprint the Download sealed page shows, and its policy must name no site. Run daily and after each deploy by
// .github/workflows/live.yml; locally: node --experimental-strip-types scripts/livecheck.ts
import { createHash } from 'node:crypto';
import { HEADERS, headerProblems, SITE, strangerScripts, unhashed } from '../src/lib/headers.ts';
import { policyOf, SEALED_FACTS, SEALED_FILE, unsealed, type SealedFacts } from '../src/lib/sealedfile.ts';

// A browser's User-Agent: some proxies only add their scripts for browsers.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36';

const res = await fetch(SITE, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'manual' });
const problems = res.status === 200 ? headerProblems(res.headers) : [`${SITE} answered ${res.status}`];
if (res.status === 200) {
  const html = await res.text();
  problems.push(...strangerScripts(html).map((tag) => `a script that isn't the app's: ${tag}`));
  problems.push(...unhashed(html).map((tag) => `a file of the app with no integrity hash: ${tag}`));
}

const factsRes = await fetch(SITE + SEALED_FACTS);
const fileRes = await fetch(SITE + SEALED_FILE);
if (!factsRes.ok || !fileRes.ok) problems.push(`the sealed file or its facts are missing (${fileRes.status}, ${factsRes.status})`);
else {
  const facts = (await factsRes.json()) as SealedFacts;
  const file = Buffer.from(await fileRes.arrayBuffer());
  const page = file.toString('utf8');
  if (createHash('sha256').update(file).digest('hex').toUpperCase() !== facts.sha256) problems.push("the sealed file doesn't match its fingerprint");
  if (policyOf(page) !== facts.policy) problems.push("the sealed file's policy isn't the one the download page shows");
  problems.push(...unsealed(policyOf(page)).map((p) => `the sealed file's policy: ${p}`));
}

const http = await fetch(SITE.replace('https:', 'http:'), { redirect: 'manual' });
if (http.status !== 301 || http.headers.get('location') !== SITE) problems.push(`http:// answered ${http.status}, not a redirect to https`);

if (problems.length) {
  console.error(`The live site doesn't match src/lib/headers.ts:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`${SITE}: all ${Object.keys(HEADERS).length} security headers as expected, no stranger scripts; the sealed file matches its fingerprint and names no site.`);
