// The For IT page (SE-8, board 93): what the app does on a computer and how to check it, as data. The page in the app
// (screens/ForIT.svelte) and docs/for-it.md (forItMarkdown) are both made from it, so they can't drift apart. The
// facts that change with the code (the address, the policy, the refused permissions) are read from the code;
// tests/unit/forit.test.ts fails when the code keeps something in the browser that the page doesn't list.

import { POLICY } from './csp';
import { HEADERS, SITE } from './headers';
import { REPO } from './version';
import { SEALED_FILE } from './sealedfile';

/** Text with `code` and [links](https://…), the only markup a paragraph or a cell may have. */
export type Block =
  | { p: string }
  | { list: string[] }
  | { table: { head: string[]; rows: string[][] } }
  | { checks: { t: string; d: string }[] }
  | { flow: true };
export type Section = { id: string; title: string; blocks: Block[] };

export const HOST = new URL(SITE).host;

/** Every IndexedDB database the app opens, and what's in it (the test checks this against the code). */
export const DATABASES: Record<string, { what: string; sealed?: true }> = {
  'script-studio': { what: "The picked folder's handle, so the app can ask for it again next time. Not the files." },
  'script-studio-history': { what: 'Copies of older versions already read from the folder, so History opens quickly. Script text.' },
  'script-studio-chapters': { what: "Copies of History's packed chapters already read from the folder. Script text." },
  'script-studio-comments': { what: 'Comments already read from the folder, so a script opens quickly. Comment text.' },
  'script-studio-models': { what: 'The speech models, if you added them in Settings, checked against their pinned SHA-256.', sealed: true },
  'script-studio-example': { what: "The example's made-up script, while you try it.", sealed: true },
};

/** The kinds of keys the app keeps in localStorage that name or hold a script (the rest are settings). */
export const LOCAL_KEYS: Record<string, string> = {
  'unsaved:': "Typing not saved to the folder yet, in case the tab closes first, under the folder's and script's names. Removed once saved.",
  'seen-': 'When you last looked at each tab of a script, under the folder and script names (for the counts on the tabs).',
  'studio.name': 'Your name, as you typed it.',
};

/** The links in the page. */
const L = {
  repo: REPO,
  security: `${REPO}/blob/main/SECURITY.md`,
  asvs: `${REPO}/blob/main/docs/asvs.md`,
  proof: `${REPO}/blob/main/docs/security.md#se-7-checking-what-the-site-serves`,
  devtools: 'https://developer.chrome.com/docs/devtools/network',
  evaluator: 'https://csp-evaluator.withgoogle.com/',
  observatory: 'https://developer.mozilla.org/observatory',
  zap: 'https://www.zaproxy.org/docs/docker/baseline-scan/',
  hash: 'https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/get-filehash',
  attest: 'https://cli.github.com/manual/gh_attestation_verify',
  procmon: 'https://learn.microsoft.com/sysinternals/downloads/procmon',
  virustotal: 'https://www.virustotal.com/',
  chrome: 'https://chromeenterprise.google/policies/',
  edge: 'https://learn.microsoft.com/deployedge/microsoft-edge-policies',
  asvsSite: 'https://owasp.org/www-project-application-security-verification-standard/',
};

/** The permissions the site's header refuses outright ("camera=()"), in plain words. */
export function refused(header = HEADERS['permissions-policy']): string[] {
  const words: Record<string, string> = { camera: 'camera', geolocation: 'location', payment: 'payments', usb: 'USB', serial: 'serial ports', hid: 'HID devices', midi: 'MIDI' };
  return header.split(',').map((p) => p.trim()).filter((p) => p.endsWith('=()')).map((p) => words[p.slice(0, -3)] ?? p.slice(0, -3));
}

/** Addresses other than the site's own that the policy lets the page connect to (none today). */
export function otherHosts(policy = POLICY): string[] {
  return (policy['connect-src'] ?? []).filter((s) => !s.startsWith("'") && !/^(blob|data):$/.test(s));
}

const code = (s: string) => '`' + s + '`';

export function forIt(sealed: boolean): Section[] {
  const where = sealed ? 'file:///C:/Apps/' + SEALED_FILE : `https://${HOST}`;
  const dbs = Object.entries(DATABASES).filter(([, d]) => sealed || !d.sealed);
  const hosts = otherHosts();
  return [
    { id: 'short', title: 'In short', blocks: [{ list: [
      'A static web page: no server of ours, no database, no accounts, no sign-in, no analytics, no tracking.',
      "Scripts, takes and comments are files in the team's own folder. The app reads and writes them through the browser; they never go anywhere else.",
      sealed
        ? 'The sealed file connects to nothing at all: its policy allows no address.'
        : 'The page connects to one address, its own. It sends nothing there: it only downloads the app and the speech models.',
      "The browser enforces these rules itself (the Content Security Policy), so a mistake in the app can't quietly break them.",
    ] }] },
    { id: 'data', title: 'Where the data goes', blocks: [{ flow: true }, { p: sealed
      ? 'The file opens from the computer, and the app talks only to the folder you pick. There is nothing to connect to.'
      : 'The arrows are the only ways data moves. The website is downloaded like any page and never receives anything from the app: no form, no upload, no analytics.' }] },
    { id: 'permissions', title: 'What it asks permission for', blocks: [{ table: { head: ['Permission', 'Why, and when', 'Browser feature'], rows: [
      ['One folder, read and write', 'The folder you pick, nothing above or beside it. The browser asks, and asks again after a restart.', 'File System Access'],
      ['Microphone', 'Only when you record a take or turn on Follow my voice. The sound is saved to the folder or heard on the computer, never sent.', code('getUserMedia')],
      ['Clipboard', 'Writes when you press a Copy button; reads only when you paste.', 'Clipboard'],
      sealed
        ? ['Everything else', "Never asked for. A file opened from the computer can't carry a Permissions-Policy header, so this one rests on the code, which is public.", '']
        : ['Everything else', `Refused by the site's own header: ${refused().join(', ')}.`, code('Permissions-Policy')],
    ] } }] },
    { id: 'addresses', title: 'Network addresses', blocks: sealed
      ? [{ p: "None. The sealed file's policy names no address at all, so the browser refuses every request. Links to other sites show as text with Copy, and Feedback copies its text and picture instead of opening GitHub." }]
      : [
        { table: { head: ['Address (HTTPS, port 443)', 'What for'], rows: [
          [code(HOST), `The app's files and the speech models. The only address the page may connect to (${code("connect-src 'self'")}). Served by GitHub Pages behind Cloudflare.`],
          ...hosts.map((h) => [code(h), 'Allowed by the policy too.']),
          [code('a.nel.cloudflare.com'), "Not the app: Cloudflare's Network Error Logging header asks Chrome to report a failed connection to the site (the address and the error, never the page's content)."],
          [code('github.com'), 'Only a link you click, opened in a new tab: Feedback (a new issue with what you typed), the code, the version, the speech models for the sealed file.'],
        ] } },
        { p: `To let it through a proxy or filter, allow ${code(HOST)}. Blocking github.com loses nothing but those links.` },
      ] },
    { id: 'keeps', title: 'What the browser keeps', blocks: [
      { p: 'On this computer, for this site only. Clearing the site\'s data (the padlock in the address bar › Site settings › Delete data) removes all of it; the scripts in the folder are untouched.' },
      { table: { head: ['Where', 'What'], rows: [
        ...dbs.map(([name, d]) => [code('IndexedDB ' + name), d.what]),
        ...(sealed ? [] : [['Private file storage', "The example's made-up script, while you try it."]]),
        ...Object.entries(LOCAL_KEYS).map(([key, what]) => [code('localStorage ' + key + (key.endsWith(':') || key.endsWith('-') ? '…' : '')), what]),
        ['localStorage, other keys', 'Settings: hide help text, the timeline open, print and teleprompter choices, the microphone picked, the tour seen.'],
        [code('sessionStorage studio.example'), 'Whether this tab is in the example. Gone when the tab closes.'],
        ...(sealed ? [] : [['Browser cache', "The app's files and the speech models, as for any website."]]),
      ] } },
    ] },
    { id: 'check', title: 'How to check it', blocks: [{ checks: sealed ? [
      { t: "It's the file we published", d: `${code('Get-FileHash .\\' + SEALED_FILE)} in PowerShell, against the fingerprint on the website's Download sealed page. [Get-FileHash](${L.hash})` },
      { t: 'It was built from the public code, by GitHub', d: `${code(`gh attestation verify ${SEALED_FILE} -R kiva-mccr/p2p-script-studio`)} [gh attestation verify](${L.attest})` },
      { t: 'Its rules allow no address', d: `The Content Security Policy is the first tag in the file. Paste it into Google's evaluator. [CSP Evaluator](${L.evaluator})` },
      { t: 'Watch it', d: `F12 › Network while you use it: nothing leaves the page. Or Process Monitor, or Wireshark. [Process Monitor](${L.procmon})` },
      { t: 'A malware scan', d: `Its fingerprint on VirusTotal, or Microsoft Defender (right-click the file › Scan with Microsoft Defender). [VirusTotal](${L.virustotal})` },
    ] : [
      { t: 'Watch the network', d: `Press F12, open the Network tab and use the app: every request goes to ${code(HOST)}. [Chrome DevTools: Network](${L.devtools})` },
      { t: 'Read the rules', d: `The policy is the first tag in the page and a response header. Paste it into Google's evaluator. [CSP Evaluator](${L.evaluator})` },
      { t: 'Grade the headers', d: `MDN's HTTP Observatory on ${code(HOST)}. The app's own check runs daily and fails if a header changes. [HTTP Observatory](${L.observatory})` },
      { t: 'Scan it', d: `An OWASP ZAP baseline scan, or the scanner you already use: ${code(`zap-baseline.py -t https://${HOST}/`)} [ZAP baseline scan](${L.zap})` },
      { t: 'Match it to the code', d: `Each update publishes ${code('sha256sums.txt')}, every file's SHA-256, signed by GitHub's build. The build is reproducible, so you can also build it yourself and compare. [How](${L.proof})` },
    ] }] },
    { id: 'policies', title: 'Browser policies IT can set', blocks: [
      { p: `Chrome and Edge use the same names (Group Policy, Intune or the registry). All optional: the app works without any. [Chrome's policies](${L.chrome}) · [Edge's policies](${L.edge})` },
      { table: { head: ['Policy', 'Set to, and what it does'], rows: [
        [code('FileSystemReadAskForUrls') + ', ' + code('FileSystemWriteAskForUrls'), `${code(where)} · lets the app ask for a folder even where folder access is turned off for other sites.`],
        [code('DefaultFileSystemReadGuardSetting') + ', ' + code('DefaultFileSystemWriteGuardSetting'), `${code('2')} (block) · with the line above, only this app may ask for folders.`],
        [code('AudioCaptureAllowedUrls'), `${code(where)} · the microphone without asking each time. Optional.`],
        sealed
          ? [code('URLBlocklist') + ', ' + code('URLAllowlist'), `Where ${code('file://')} is blocked: allow the sealed file's own path.`]
          : [code('URLAllowlist'), `${code(where)} · where a URL blocklist is in use.`],
        [code('ClearBrowsingDataOnExitList'), 'Leave site data out of it, or the app forgets the folder and its copies of History whenever the browser closes.'],
      ] } },
    ] },
    { id: 'asvs', title: 'OWASP ASVS level 1', blocks: [
      { p: `[ASVS 5.0](${L.asvsSite}), chapter by chapter. Most chapters are about servers, accounts and sign-in, which the app doesn't have. Every level 1 requirement, one by one: [docs/asvs.md](${L.asvs}).` },
      { table: { head: ['Chapter', 'Status', 'How'], rows: [
        ['V1 Encoding and sanitization', 'Met', "Script text reaches the page only through an escaper; links only http(s); no eval. Tests try to sneak scripts in everywhere."],
        ['V2 Validation and business logic', 'Met', "Folder files are read against their formats (docs/script-format.md, docs/studio-folder.md); anything unexpected shows as text."],
        ['V3 Web frontend security', 'Met', 'Content Security Policy, frame-ancestors none, nosniff, HSTS for a year, integrity hashes; folder files open only as pictures, PDFs, text, video or sound.'],
        ['V4 API and web service', 'Met', 'Every file is served with its type and charset; no WebSockets.'],
        ['V5 File handling', 'Mostly met', 'Nothing is uploaded; file names are checked by the browser, so no path can leave the folder; the speech models are checked by SHA-256. Only files attached to comments have a size limit.'],
        ['V6 to V10 Sign-in, sessions, authorization, tokens, OAuth', 'Not applicable', "No accounts: the folder's own Windows permissions decide who can read and change it."],
        ['V11 Cryptography', 'Met', 'Nothing is encrypted; SHA-256 checks files.'],
        ['V12 Secure communication', 'Met', sealed ? 'The sealed file makes no connections.' : 'HTTPS only (TLS 1.2 and 1.3), HSTS, publicly trusted certificates.'],
        ['V13 Configuration', 'Met', 'Only the built files are published (no .git); no secrets in the code; secret scanning.'],
        ['V14 Data protection', 'Met', 'No data leaves the computer; nothing in addresses is sent anywhere; what the browser keeps is listed above.'],
        ['V15 Secure coding and architecture', 'Met', 'Fix times in SECURITY.md; every change fails while a shipped package has a known vulnerability.'],
      ] } },
    ] },
    { id: 'report', title: 'Reporting a problem', blocks: [{ p: `Privately, through GitHub: the code's Security tab › Report a vulnerability, never a public issue. An answer within 5 working days. Only the latest version is supported: the website always is it, and a sealed file is replaced from Download sealed. [SECURITY.md](${L.security})` }] },
  ];
}

/** One piece of a line of text: plain, `code`, or a [link](…). */
export type Piece = { text: string; code?: true; href?: string };

export function pieces(line: string): Piece[] {
  const out: Piece[] = [];
  const re = /`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^)\s]+|#[^)\s]*)\)/g;
  let at = 0;
  for (const m of line.matchAll(re)) {
    if (m.index > at) out.push({ text: line.slice(at, m.index) });
    out.push(m[1] !== undefined ? { text: m[1], code: true } : { text: m[2], href: m[3] });
    at = m.index + m[0].length;
  }
  if (at < line.length) out.push({ text: line.slice(at) });
  return out;
}

const FLOW_TEXT: Record<'site' | 'sealed', string> = {
  site: `    ${HOST}  ──(the app, the speech models)──▶  Chrome or Edge on your computer  ◀──(read and write)──▶  the team's folder\n    (nothing is sent back)`,
  sealed: "    (no internet)   ✕   Chrome or Edge on your computer, the sealed file  ◀──(read and write)──▶  the team's folder",
};

function blockMarkdown(b: Block, sealed: boolean): string {
  if ('p' in b) return b.p;
  if ('list' in b) return b.list.map((x) => `- ${x}`).join('\n');
  if ('checks' in b) return b.checks.map((c, i) => `${i + 1}. **${c.t}.** ${c.d}`).join('\n');
  if ('flow' in b) return '```text\n' + FLOW_TEXT[sealed ? 'sealed' : 'site'] + '\n```';
  const row = (cells: string[]) => `| ${cells.map((c) => c.replaceAll('|', '\\|')).join(' | ')} |`;
  return [row(b.table.head), row(b.table.head.map(() => '---')), ...b.table.rows.map(row)].join('\n');
}

/** docs/for-it.md: the website's page, then each section the sealed file's copy says differently. */
export function forItMarkdown(): string {
  const site = forIt(false);
  const sealed = forIt(true);
  const section = (s: Section, isSealed: boolean, hashes: string) =>
    `${hashes} ${s.title}\n\n${s.blocks.map((b) => blockMarkdown(b, isSealed)).join('\n\n')}`;
  const differs = sealed.filter((s, i) => JSON.stringify(s) !== JSON.stringify(site[i]));
  return [
    '# For IT',
    '<!-- Made from src/lib/forit.ts: change it there, then run UPDATE_DOCS=1 npx vitest run forit -->',
    `P2P Script Studio: what it does on a computer, and how to check it yourself. The same page is in the app (? › For IT), for the version you're using.`,
    ...site.map((s) => section(s, false, '##')),
    '## The sealed file',
    `The sealed file (${code(SEALED_FILE)}, from ? › Download sealed) carries its own copy of this page. Where it differs:`,
    ...differs.map((s) => section(s, true, '###')),
  ].join('\n\n') + '\n';
}
