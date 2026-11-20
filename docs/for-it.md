# For IT

<!-- Made from src/lib/forit.ts: change it there, then run UPDATE_DOCS=1 npx vitest run forit -->

P2P Script Studio: what it does on a computer, and how to check it yourself. The same page is in the app (? › For IT), for the version you're using.

## In short

- A static web page: no server of ours, no database, no accounts, no sign-in, no analytics, no tracking.
- Scripts, takes and comments are files in the team's own folder. The app reads and writes them through the browser; they never go anywhere else.
- The page connects to one address, its own. It sends nothing there: it only downloads the app and the speech models.
- The browser enforces these rules itself (the Content Security Policy), so a mistake in the app can't quietly break them.

## Where the data goes

```text
    p2p-script-studio.kivamccr.xyz  ──(the app, the speech models)──▶  Chrome or Edge on your computer  ◀──(read and write)──▶  the team's folder
    (nothing is sent back)
```

The arrows are the only ways data moves. The website is downloaded like any page and never receives anything from the app: no form, no upload, no analytics.

## What it asks permission for

| Permission | Why, and when | Browser feature |
| --- | --- | --- |
| One folder, read and write | The folder you pick, nothing above or beside it. The browser asks, and asks again after a restart. | File System Access |
| Microphone | Only when you record a take or turn on Follow my voice. The sound is saved to the folder or heard on the computer, never sent. | `getUserMedia` |
| Clipboard | Writes when you press a Copy button; reads only when you paste. | Clipboard |
| Everything else | Refused by the site's own header: camera, location, payments, USB, serial ports, HID devices, MIDI. | `Permissions-Policy` |

## Network addresses

| Address (HTTPS, port 443) | What for |
| --- | --- |
| `p2p-script-studio.kivamccr.xyz` | The app's files and the speech models. The only address the page may connect to (`connect-src 'self'`). Served by GitHub Pages behind Cloudflare. |
| `a.nel.cloudflare.com` | Not the app: Cloudflare's Network Error Logging header asks Chrome to report a failed connection to the site (the address and the error, never the page's content). |
| `github.com` | Only a link you click, opened in a new tab: Feedback (a new issue with what you typed), the code, the version, the speech models for the sealed file. |

To let it through a proxy or filter, allow `p2p-script-studio.kivamccr.xyz`. Blocking github.com loses nothing but those links.

## What the browser keeps

On this computer, for this site only. Clearing the site's data (the padlock in the address bar › Site settings › Delete data) removes all of it; the scripts in the folder are untouched.

| Where | What |
| --- | --- |
| `IndexedDB script-studio` | The picked folder's handle, so the app can ask for it again next time. Not the files. |
| `IndexedDB script-studio-history` | Copies of older versions already read from the folder, so History opens quickly. Script text. |
| `IndexedDB script-studio-chapters` | Copies of History's packed chapters already read from the folder. Script text. |
| `IndexedDB script-studio-comments` | Comments already read from the folder, so a script opens quickly. Comment text. |
| Private file storage | The example's made-up script, while you try it. |
| `localStorage unsaved:…` | Typing not saved to the folder yet, in case the tab closes first, under the folder's and script's names. Removed once saved. |
| `localStorage seen-…` | When you last looked at each tab of a script, under the folder and script names (for the counts on the tabs). |
| `localStorage studio.name` | Your name, as you typed it. |
| localStorage, other keys | Settings: hide help text, the timeline open, print and teleprompter choices, the microphone picked, the tour seen. |
| `sessionStorage studio.example` | Whether this tab is in the example. Gone when the tab closes. |
| Browser cache | The app's files and the speech models, as for any website. |

## How to check it

1. **Watch the network.** Press F12, open the Network tab and use the app: every request goes to `p2p-script-studio.kivamccr.xyz`. [Chrome DevTools: Network](https://developer.chrome.com/docs/devtools/network)
2. **Read the rules.** The policy is the first tag in the page and a response header. Paste it into Google's evaluator. [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
3. **Grade the headers.** MDN's HTTP Observatory on `p2p-script-studio.kivamccr.xyz`. The app's own check runs daily and fails if a header changes. [HTTP Observatory](https://developer.mozilla.org/observatory)
4. **Scan it.** An OWASP ZAP baseline scan, or the scanner you already use: `zap-baseline.py -t https://p2p-script-studio.kivamccr.xyz/` [ZAP baseline scan](https://www.zaproxy.org/docs/docker/baseline-scan/)
5. **Match it to the code.** Each update publishes `sha256sums.txt`, every file's SHA-256, signed by GitHub's build. The build is reproducible, so you can also build it yourself and compare. [How](https://github.com/kiva-mccr/p2p-script-studio/blob/main/docs/security.md#se-7-checking-what-the-site-serves)

## Browser policies IT can set

Chrome and Edge use the same names (Group Policy, Intune or the registry). All optional: the app works without any. [Chrome's policies](https://chromeenterprise.google/policies/) · [Edge's policies](https://learn.microsoft.com/deployedge/microsoft-edge-policies)

| Policy | Set to, and what it does |
| --- | --- |
| `FileSystemReadAskForUrls`, `FileSystemWriteAskForUrls` | `https://p2p-script-studio.kivamccr.xyz` · lets the app ask for a folder even where folder access is turned off for other sites. |
| `DefaultFileSystemReadGuardSetting`, `DefaultFileSystemWriteGuardSetting` | `2` (block) · with the line above, only this app may ask for folders. |
| `AudioCaptureAllowedUrls` | `https://p2p-script-studio.kivamccr.xyz` · the microphone without asking each time. Optional. |
| `URLAllowlist` | `https://p2p-script-studio.kivamccr.xyz` · where a URL blocklist is in use. |
| `ClearBrowsingDataOnExitList` | Leave site data out of it, or the app forgets the folder and its copies of History whenever the browser closes. |

## OWASP ASVS level 1

[ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/), chapter by chapter. Most chapters are about servers, accounts and sign-in, which the app doesn't have. Every level 1 requirement, one by one: [docs/asvs.md](https://github.com/kiva-mccr/p2p-script-studio/blob/main/docs/asvs.md).

| Chapter | Status | How |
| --- | --- | --- |
| V1 Encoding and sanitization | Met | Script text reaches the page only through an escaper; links only http(s); no eval. Tests try to sneak scripts in everywhere. |
| V2 Validation and business logic | Met | Folder files are read against their formats (docs/script-format.md, docs/studio-folder.md); anything unexpected shows as text. |
| V3 Web frontend security | Met | Content Security Policy, frame-ancestors none, nosniff, HSTS for a year, integrity hashes; folder files open only as pictures, PDFs, text, video or sound. |
| V4 API and web service | Met | Every file is served with its type and charset; no WebSockets. |
| V5 File handling | Mostly met | Nothing is uploaded; file names are checked by the browser, so no path can leave the folder; the speech models are checked by SHA-256. Only files attached to comments have a size limit. |
| V6 to V10 Sign-in, sessions, authorization, tokens, OAuth | Not applicable | No accounts: the folder's own Windows permissions decide who can read and change it. |
| V11 Cryptography | Met | Nothing is encrypted; SHA-256 checks files. |
| V12 Secure communication | Met | HTTPS only (TLS 1.2 and 1.3), HSTS, publicly trusted certificates. |
| V13 Configuration | Met | Only the built files are published (no .git); no secrets in the code; secret scanning. |
| V14 Data protection | Met | No data leaves the computer; nothing in addresses is sent anywhere; what the browser keeps is listed above. |
| V15 Secure coding and architecture | Met | Fix times in SECURITY.md; every change fails while a shipped package has a known vulnerability. |

## Reporting a problem

Privately, through GitHub: the code's Security tab › Report a vulnerability, never a public issue. An answer within 5 working days. Only the latest version is supported: the website always is it, and a sealed file is replaced from Download sealed. [SECURITY.md](https://github.com/kiva-mccr/p2p-script-studio/blob/main/SECURITY.md)

## The sealed file

The sealed file (`script-studio-sealed.html`, from ? › Download sealed) carries its own copy of this page. Where it differs:

### In short

- A static web page: no server of ours, no database, no accounts, no sign-in, no analytics, no tracking.
- Scripts, takes and comments are files in the team's own folder. The app reads and writes them through the browser; they never go anywhere else.
- The sealed file connects to nothing at all: its policy allows no address.
- The browser enforces these rules itself (the Content Security Policy), so a mistake in the app can't quietly break them.

### Where the data goes

```text
    (no internet)   ✕   Chrome or Edge on your computer, the sealed file  ◀──(read and write)──▶  the team's folder
```

The file opens from the computer, and the app talks only to the folder you pick. There is nothing to connect to.

### What it asks permission for

| Permission | Why, and when | Browser feature |
| --- | --- | --- |
| One folder, read and write | The folder you pick, nothing above or beside it. The browser asks, and asks again after a restart. | File System Access |
| Microphone | Only when you record a take or turn on Follow my voice. The sound is saved to the folder or heard on the computer, never sent. | `getUserMedia` |
| Clipboard | Writes when you press a Copy button; reads only when you paste. | Clipboard |
| Everything else | Never asked for. A file opened from the computer can't carry a Permissions-Policy header, so this one rests on the code, which is public. |  |

### Network addresses

None. The sealed file's policy names no address at all, so the browser refuses every request. Links to other sites show as text with Copy, and Feedback copies its text and picture instead of opening GitHub.

### What the browser keeps

On this computer, for this site only. Clearing the site's data (the padlock in the address bar › Site settings › Delete data) removes all of it; the scripts in the folder are untouched.

| Where | What |
| --- | --- |
| `IndexedDB script-studio` | The picked folder's handle, so the app can ask for it again next time. Not the files. |
| `IndexedDB script-studio-history` | Copies of older versions already read from the folder, so History opens quickly. Script text. |
| `IndexedDB script-studio-chapters` | Copies of History's packed chapters already read from the folder. Script text. |
| `IndexedDB script-studio-comments` | Comments already read from the folder, so a script opens quickly. Comment text. |
| `IndexedDB script-studio-models` | The speech models, if you added them in Settings, checked against their pinned SHA-256. |
| `IndexedDB script-studio-example` | The example's made-up script, while you try it. |
| `localStorage unsaved:…` | Typing not saved to the folder yet, in case the tab closes first, under the folder's and script's names. Removed once saved. |
| `localStorage seen-…` | When you last looked at each tab of a script, under the folder and script names (for the counts on the tabs). |
| `localStorage studio.name` | Your name, as you typed it. |
| localStorage, other keys | Settings: hide help text, the timeline open, print and teleprompter choices, the microphone picked, the tour seen. |
| `sessionStorage studio.example` | Whether this tab is in the example. Gone when the tab closes. |

### How to check it

1. **It's the file we published.** `Get-FileHash .\script-studio-sealed.html` in PowerShell, against the fingerprint on the website's Download sealed page. [Get-FileHash](https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/get-filehash)
2. **It was built from the public code, by GitHub.** `gh attestation verify script-studio-sealed.html -R kiva-mccr/p2p-script-studio` [gh attestation verify](https://cli.github.com/manual/gh_attestation_verify)
3. **Its rules allow no address.** The Content Security Policy is the first tag in the file. Paste it into Google's evaluator. [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
4. **Watch it.** F12 › Network while you use it: nothing leaves the page. Or Process Monitor, or Wireshark. [Process Monitor](https://learn.microsoft.com/sysinternals/downloads/procmon)
5. **A malware scan.** Its fingerprint on VirusTotal, or Microsoft Defender (right-click the file › Scan with Microsoft Defender). [VirusTotal](https://www.virustotal.com/)

### Browser policies IT can set

Chrome and Edge use the same names (Group Policy, Intune or the registry). All optional: the app works without any. [Chrome's policies](https://chromeenterprise.google/policies/) · [Edge's policies](https://learn.microsoft.com/deployedge/microsoft-edge-policies)

| Policy | Set to, and what it does |
| --- | --- |
| `FileSystemReadAskForUrls`, `FileSystemWriteAskForUrls` | `file:///C:/Apps/script-studio-sealed.html` · lets the app ask for a folder even where folder access is turned off for other sites. |
| `DefaultFileSystemReadGuardSetting`, `DefaultFileSystemWriteGuardSetting` | `2` (block) · with the line above, only this app may ask for folders. |
| `AudioCaptureAllowedUrls` | `file:///C:/Apps/script-studio-sealed.html` · the microphone without asking each time. Optional. |
| `URLBlocklist`, `URLAllowlist` | Where `file://` is blocked: allow the sealed file's own path. |
| `ClearBrowsingDataOnExitList` | Leave site data out of it, or the app forgets the folder and its copies of History whenever the browser closes. |

### OWASP ASVS level 1

[ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/), chapter by chapter. Most chapters are about servers, accounts and sign-in, which the app doesn't have. Every level 1 requirement, one by one: [docs/asvs.md](https://github.com/kiva-mccr/p2p-script-studio/blob/main/docs/asvs.md).

| Chapter | Status | How |
| --- | --- | --- |
| V1 Encoding and sanitization | Met | Script text reaches the page only through an escaper; links only http(s); no eval. Tests try to sneak scripts in everywhere. |
| V2 Validation and business logic | Met | Folder files are read against their formats (docs/script-format.md, docs/studio-folder.md); anything unexpected shows as text. |
| V3 Web frontend security | Met | Content Security Policy, frame-ancestors none, nosniff, HSTS for a year, integrity hashes; folder files open only as pictures, PDFs, text, video or sound. |
| V4 API and web service | Met | Every file is served with its type and charset; no WebSockets. |
| V5 File handling | Mostly met | Nothing is uploaded; file names are checked by the browser, so no path can leave the folder; the speech models are checked by SHA-256. Only files attached to comments have a size limit. |
| V6 to V10 Sign-in, sessions, authorization, tokens, OAuth | Not applicable | No accounts: the folder's own Windows permissions decide who can read and change it. |
| V11 Cryptography | Met | Nothing is encrypted; SHA-256 checks files. |
| V12 Secure communication | Met | The sealed file makes no connections. |
| V13 Configuration | Met | Only the built files are published (no .git); no secrets in the code; secret scanning. |
| V14 Data protection | Met | No data leaves the computer; nothing in addresses is sent anywhere; what the browser keeps is listed above. |
| V15 Secure coding and architecture | Met | Fix times in SECURITY.md; every change fails while a shipped package has a known vulnerability. |
