<script lang="ts">
  import { feedback } from '../lib/help.svelte';
  import { REPO, versionLabel, versionTip, type Version } from '../lib/version';

  // The ? at the right end of every top bar (SB-5, board 77): Feedback, GitHub and the live version, which used to
  // float in the bottom corners and got in the way of the timeline's drawer. On the website, Download sealed (SE-10);
  // the sealed app itself has no GitHub link and its version is plain text (it opens no website).
  const version: Version | null = __VERSION__; // set at build time (vite.config.ts)

  let open = $state(false);
  const shown = $derived(open || feedback.tour === 'menu'); // the tour's ? step holds it open (issue #202)
  let el = $state<HTMLElement>();
  const away = (e: PointerEvent) => open && !el?.contains(e.target as Node) && (open = false);
</script>

<svelte:window onpointerdown={away} onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<span class="help-menu" bind:this={el}>
  <button class="q" data-tour="help" aria-label="Help and version" title="Feedback, GitHub and the version" aria-expanded={shown} onclick={() => (open = !open)}>?</button>
  {#if shown}
    <div class="list" role="menu" data-tour-with="help" aria-label="Help and version">
      <button role="menuitem" onclick={() => ((open = false), feedback.asked++)}>Feedback…</button>
      {#if __SEALED__}
        <hr />
        <span class="version" title={versionTip(version)}>Version: {versionLabel(version)} · sealed</span>
      {:else}
        <a role="menuitem" href={REPO} target="_blank" rel="noopener" onclick={() => (open = false)}>GitHub ↗</a>
        <a role="menuitem" href="#download-sealed" onclick={() => (open = false)}>Download sealed</a>
        <hr />
        <a role="menuitem" class="version" href={version ? `${REPO}/pull/${version.pr}` : REPO} title={versionTip(version)} target="_blank" rel="noopener"
          onclick={() => (open = false)}>Version: {versionLabel(version)} ↗</a>
      {/if}
    </div>
  {/if}
</span>

<style>
  .help-menu { position: relative; flex: none; }
  .q { width: 36px; height: 36px; padding: 0; border: 1px solid var(--line-strong); border-radius: 50%; background: #fff; color: #3d3d3d; font-size: 15px; font-weight: 600; }
  .q:hover, .q[aria-expanded='true'] { color: var(--accent); border-color: #c9d5f2; }
  .list { position: absolute; z-index: 20; top: calc(100% + 8px); right: 0; width: 220px; padding: 6px; box-sizing: border-box; border: 1px solid var(--line);
    border-radius: 10px; background: #fff; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12); display: flex; flex-direction: column; }
  .list button, .list a { display: flex; align-items: center; min-height: 40px; padding: 0 10px; border: 0; border-radius: 6px; background: none;
    font: inherit; font-size: 14px; color: var(--ink); text-align: left; text-decoration: none; cursor: pointer; }
  .list button:hover, .list a:hover { background: #f5f5f5; }
  .list .version { min-height: 36px; font-size: 12px; color: var(--muted); }
  span.version { display: flex; align-items: center; padding: 0 10px; }
  hr { height: 1px; margin: 4px; border: 0; background: #eee; }
</style>
