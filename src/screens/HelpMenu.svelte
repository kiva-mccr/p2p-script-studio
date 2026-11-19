<script lang="ts">
  import { example, feedback } from '../lib/help.svelte';
  import { REPO, versionLabel, versionTip, type Version } from '../lib/version';

  // The ? at the right end of every top bar (SB-5, board 77): Feedback, GitHub and the live version, which used to
  // float in the bottom corners and got in the way of the timeline's drawer. On the website, Download sealed (SE-10);
  // the sealed app itself has no GitHub link and its version is plain text (it opens no website).
  // On every screen (issue #219): main where it's a screen's own (the list, the first screen), dim where it sits behind
  // a script's buttons (a touch dimmer until hovered), dark on the Teleprompter's black, where it opens upwards.
  let { tone = 'main' }: { tone?: 'main' | 'dim' | 'dark' } = $props();
  const version: Version | null = __VERSION__; // set at build time (vite.config.ts)

  let open = $state(false);
  const shown = $derived(open || feedback.tour === 'menu'); // the tour's ? step holds it open (issue #202)
  let el = $state<HTMLElement>();
  const away = (e: PointerEvent) => open && !el?.contains(e.target as Node) && (open = false);
</script>

<svelte:window onpointerdown={away} onkeydown={(e) => e.key === 'Escape' && (open = false)} />

<span class="help-menu {tone}" bind:this={el}>
  <button class="q" data-tour="help" aria-label="Help and version" title="Feedback, GitHub and the version" aria-expanded={shown} onclick={() => (open = !open)}>?</button>
  {#if shown}
    <div class="list" role="menu" data-tour-with="help" aria-label="Help and version">
      <button role="menuitem" onclick={() => ((open = false), feedback.asked++)}>Feedback…</button>
      {#if !example.open}<button role="menuitem" onclick={() => ((open = false), example.asked++)}>See the example</button>{/if}
      {#if __SEALED__}
        <hr />
        <span class="version" title={versionTip(version)}>Version: {versionLabel(version)} · sealed</span>
      {:else}
        <a role="menuitem" href={REPO} target="_blank" rel="noopener" onclick={() => (open = false)}>
          <!-- GitHub's own mark (issue #232), in place of ↗. -->
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>GitHub
        </a>
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
  .dim .q:not(:hover, [aria-expanded='true']) { border-color: var(--line); color: var(--muted); }
  .dark .q { border-color: #555; background: none; color: #bbb; }
  .dark .q:hover, .dark .q[aria-expanded='true'] { border-color: #999; color: #eee; }
  .dark .list { top: auto; bottom: calc(100% + 8px); }
  .list { position: absolute; z-index: 20; top: calc(100% + 8px); right: 0; width: 220px; padding: 6px; box-sizing: border-box; border: 1px solid var(--line);
    border-radius: 10px; background: #fff; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12); display: flex; flex-direction: column; }
  .list button, .list a { display: flex; align-items: center; min-height: 40px; padding: 0 10px; border: 0; border-radius: 6px; background: none;
    font: inherit; font-size: 14px; color: var(--ink); text-align: left; text-decoration: none; cursor: pointer; gap: 8px; }
  .list button:hover, .list a:hover { background: #f5f5f5; }
  .list .version { min-height: 36px; font-size: 12px; color: var(--muted); }
  span.version { display: flex; align-items: center; padding: 0 10px; }
  hr { height: 1px; margin: 4px; border: 0; background: #eee; }
</style>
