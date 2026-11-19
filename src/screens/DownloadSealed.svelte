<script lang="ts">
  import HelpMenu from './HelpMenu.svelte';
  import { SEALED_FACTS, SEALED_FILE, type SealedFacts } from '../lib/sealedfile';
  import { REPO, versionLabel, type Version } from '../lib/version';
  import { MODELS_ZIP, type ModelsZip } from '../lib/modelfiles';

  // Download sealed (SE-10, board 89): the website's page for the sealed app, reached from the ? menu (#download-sealed).
  // What to download, and the standard checks IT can run to see that the file is sealed. The file's fingerprint, size and
  // policy come from the deploy (script-studio-sealed.json beside it). The speech models' zip (SE-5) is the second
  // download, a GitHub release asset (too big for this site); its facts are in speech-models.json beside the page.
  let { onBack }: { onBack: () => void } = $props();

  const version: Version | null = __VERSION__;
  let facts = $state<SealedFacts | null>(null);
  let missing = $state(false);
  let models = $state<ModelsZip | null>(null);
  let withModels = $state(false);
  let copied = $state<'' | 'hash' | 'models' | 'policy'>('');

  fetch(`./${SEALED_FACTS}`, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((f: SealedFacts) => (facts = f))
    .catch(() => (missing = true));
  fetch('./speech-models.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((m: ModelsZip) => (models = m))
    .catch(() => {});

  const mb = (bytes: number) => `${Math.round(bytes / 1e6)} MB`;

  async function copy(what: 'hash' | 'models' | 'policy', text: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
    copied = what;
    setTimeout(() => copied === what && (copied = ''), 2000);
  }
</script>

<header>
  <button class="link back" onclick={onBack}>← Back</button>
  <h1>Download sealed</h1>
  <HelpMenu />
</header>

<main>
  <h2 class="title">Download the sealed app</h2>
  <p class="lead">One file you open in Chrome or Edge, with no install. It can't reach the internet or any other address, only the
    folder you pick. It never updates itself: for a new version, come back here.</p>

  <fieldset>
    <legend>What to download</legend>
    <label class="choice" class:on={!withModels}>
      <input type="radio" name="what" checked={!withModels} onchange={() => (withModels = false)} />
      <span><b>The app</b><small>{SEALED_FILE} · everything but Follow my voice and cuts timed from the take</small></span>
    </label>
    {#if models}
      <label class="choice" class:on={withModels}>
        <input type="radio" name="what" checked={withModels} onchange={() => (withModels = true)} />
        <span><b>The app and the speech models</b><small>Two files. Add {MODELS_ZIP} once, in the app's Settings: it's
          checked there, file by file, and kept by the browser.</small></span>
      </label>
    {/if}
  </fieldset>

  <div class="get">
    <a class="primary" href="./{SEALED_FILE}" download={SEALED_FILE}>Download the app</a>
    {#if withModels && models}<a class="primary" href={models.url}>Download the speech models</a>{/if}
    <span class="meta">Version: {versionLabel(version)}{facts ? ` · ${mb(facts.bytes)}` : ''}{withModels && models ? ` · models ${mb(models.bytes)}` : ''}</span>
  </div>
  {#if missing}<p class="bad" role="status">The sealed file isn't on this site yet. Try again after the next update.</p>{/if}

  <h2>Check that it's sealed</h2>
  <p class="lead small">For IT, or anyone who'd rather double check. Each check uses a standard tool.</p>

  <ol>
    <li>
      <h3>1. It's the file we published</h3>
      <p>Its SHA-256 fingerprint: <code class="hash">{facts?.sha256 ?? '…'}</code>
        {#if facts}<button class="outline small-btn" onclick={() => copy('hash', facts!.sha256)}>{copied === 'hash' ? 'Copied' : 'Copy'}</button>{/if}</p>
      {#if withModels && models}
        <p>The speech models' fingerprint: <code class="hash">{models.sha256}</code>
          <button class="outline small-btn" onclick={() => copy('models', models!.sha256)}>{copied === 'models' ? 'Copied' : 'Copy'}</button></p>
      {/if}
      <p>In PowerShell: <code>Get-FileHash .\{SEALED_FILE}</code> ·
        <a href="https://learn.microsoft.com/powershell/module/microsoft.powershell.utility/get-filehash" target="_blank" rel="noopener">Microsoft's Get-FileHash ↗</a></p>
    </li>
    <li>
      <h3>2. It was built from the public code, by GitHub</h3>
      <p>Each update signs a build attestation (Sigstore): <code>gh attestation verify {SEALED_FILE} -R kiva-mccr/p2p-script-studio</code></p>
      {#if withModels && models}<p>The models too: <code>gh attestation verify {MODELS_ZIP} -R kiva-mccr/p2p-script-studio</code></p>{/if}
      <p><a href="https://docs.github.com/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds" target="_blank" rel="noopener">GitHub's artifact attestations ↗</a> ·
        <a href="https://cli.github.com/manual/gh_attestation_verify" target="_blank" rel="noopener">gh attestation verify ↗</a> ·
        <a href={REPO} target="_blank" rel="noopener">The code ↗</a></p>
    </li>
    <li>
      <h3>3. Its rules allow no address</h3>
      <p>The Content Security Policy is the first tag in the file, and Chrome and Edge enforce it: no http or https source at all,
        its script and stylesheet only by their fingerprint.
        {#if facts}<button class="outline small-btn" onclick={() => copy('policy', facts!.policy)}>{copied === 'policy' ? 'Copied' : 'Copy the policy'}</button>{/if}</p>
      <p><a href="https://csp-evaluator.withgoogle.com/" target="_blank" rel="noopener">Google's CSP Evaluator ↗</a> ·
        <a href="https://developer.mozilla.org/docs/Web/HTTP/CSP" target="_blank" rel="noopener">MDN on the policy ↗</a></p>
    </li>
    <li>
      <h3>4. Watch it</h3>
      <p>Open the file, press F12, and keep the Network tab open while you use it: nothing leaves the page. Or watch the computer
        itself with Process Monitor or Wireshark.</p>
      <p><a href="https://developer.chrome.com/docs/devtools/network" target="_blank" rel="noopener">Chrome DevTools: Network ↗</a> ·
        <a href="https://learn.microsoft.com/sysinternals/downloads/procmon" target="_blank" rel="noopener">Process Monitor ↗</a> ·
        <a href="https://www.wireshark.org/" target="_blank" rel="noopener">Wireshark ↗</a></p>
    </li>
    <li>
      <h3>5. A malware scan</h3>
      <p>Look its fingerprint up on VirusTotal, or scan it with Microsoft Defender (right-click the file › Scan with Microsoft Defender).</p>
      <p><a href={facts ? `https://www.virustotal.com/gui/file/${facts.sha256.toLowerCase()}` : 'https://www.virustotal.com/'} target="_blank" rel="noopener">VirusTotal ↗</a></p>
    </li>
  </ol>
</main>

<style>
  header { display: flex; align-items: center; gap: 8px; padding: 12px 24px; border-bottom: 1px solid var(--line); }
  header h1 { flex: 1; margin: 0; font-size: 15px; font-weight: 600; }
  .back { margin-left: -12px; }
  main { max-width: 760px; margin: 0 auto; padding: 28px 24px 96px; }
  .title { margin: 0 0 6px; font-size: 22px; }
  h2 { margin: 32px 0 6px; font-size: 16px; font-weight: 600; }
  .lead { margin: 0 0 22px; font-size: 14px; line-height: 1.6; color: #3d3d3d; }
  .lead.small { font-size: 13px; margin-bottom: 14px; }
  fieldset { margin: 0 0 18px; padding: 0; border: 0; }
  legend { margin-bottom: 10px; font-size: 14px; font-weight: 600; }
  .choice { display: flex; gap: 12px; padding: 14px; border: 1px solid var(--line); border-radius: 10px; cursor: pointer; }
  .choice.on { border-color: var(--accent); background: #eef2fc; }
  .choice input { width: 18px; height: 18px; margin: 2px 0 0; }
  .choice span { display: flex; flex-direction: column; gap: 3px; font-size: 14px; }
  .choice b { font-weight: 500; }
  .choice small { font-size: 13px; line-height: 1.5; color: var(--muted); }
  .get { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
  .get .primary { min-height: 44px; padding: 0 20px; font-size: 14px; text-decoration: none; color: #fff; }
  .meta { font-size: 13px; color: var(--muted); }
  .bad { color: var(--danger); font-size: 14px; }
  ol { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
  li { padding: 14px; border: 1px solid var(--line); border-radius: 10px; }
  h3 { margin: 0 0 4px; font-size: 14px; font-weight: 500; }
  li p { margin: 4px 0 0; font-size: 13px; line-height: 1.6; color: #3d3d3d; overflow-wrap: anywhere; }
  code { font: 12px ui-monospace, Consolas, monospace; background: #f5f5f5; padding: 1px 4px; border-radius: 4px; }
  a { color: var(--accent); }
  .small-btn { min-height: 28px; padding: 0 8px; font-size: 12px; font-weight: 400; margin-left: 4px; }
</style>
