<script lang="ts">
  import { onMount } from 'svelte';
  import HelpMenu from './HelpMenu.svelte';
  import { forIt, HOST, pieces } from '../lib/forit';
  import { versionLabel, type Version } from '../lib/version';

  // For IT (SE-8, board 93): one page IT can read, print or send on, from ? › For IT (#for-it, App.svelte), on the
  // website and in the sealed file alike. Its text is lib/forit.ts. The contents on the left stay put while the page
  // scrolls, light the section being read, and jump to a section when clicked.
  let { onBack }: { onBack: () => void } = $props();

  const version: Version | null = __VERSION__;
  const sections = forIt(__SEALED__);
  let current = $state(sections[0].id);
  let jumping = 0; // while a click's smooth scroll runs, the clicked entry stays lit

  function go(id: string) {
    current = id;
    jumping = Date.now();
    document.getElementById(`it-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function onScroll() {
    if (Date.now() - jumping < 800) return;
    const bottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    let id = sections[0].id;
    for (const s of sections) if ((document.getElementById(`it-${s.id}`)?.getBoundingClientRect().top ?? 1e9) <= 96) id = s.id;
    current = bottom ? sections[sections.length - 1].id : id;
  }
  onMount(() => window.scrollTo(0, 0));
</script>

<svelte:window onscroll={onScroll} />

{#snippet line(text: string)}
  {#each pieces(text) as p, i (i)}{#if p.code}<code>{p.text}</code>{:else if p.href}<a href={p.href} target="_blank" rel="noopener">{p.text}{p.href.startsWith('#') ? '' : ' ↗'}</a>{:else}{p.text}{/if}{/each}
{/snippet}

<header>
  <button class="link back" onclick={onBack}>← Back</button>
  <h1>For IT</h1>
  <button class="outline print" onclick={() => window.print()}>Print or save as PDF</button>
  <HelpMenu />
</header>

<div class="page">
  <nav aria-label="On this page">
    <span class="nav-title">On this page</span>
    {#each sections as s (s.id)}
      <button class:on={current === s.id} aria-current={current === s.id ? 'location' : undefined} onclick={() => go(s.id)}>{s.title}</button>
    {/each}
  </nav>

  <main>
    <h2 class="title">For IT</h2>
    <p class="lead">P2P Script Studio{__SEALED__ ? ' as one sealed file' : ', the website'}: what it does on a computer, and how to check it yourself.</p>
    <p class="meta">Version: {versionLabel(version)}{__SEALED__ ? ' · sealed' : ''} · this page changes with the code, so it describes the version you're using</p>

    {#each sections as s (s.id)}
      <section aria-labelledby="it-{s.id}">
        <h2 id="it-{s.id}">{s.title}</h2>
        {#each s.blocks as b, i (i)}
          {#if 'p' in b}
            <p>{@render line(b.p)}</p>
          {:else if 'list' in b}
            <ul>{#each b.list as x, j (j)}<li>{@render line(x)}</li>{/each}</ul>
          {:else if 'checks' in b}
            <ol class="checks">
              {#each b.checks as c, j (j)}<li><h3>{j + 1}. {c.t}</h3><p>{@render line(c.d)}</p></li>{/each}
            </ol>
          {:else if 'table' in b}
            <div class="table" class:three={b.table.head.length === 3} class:status={b.table.head[1] === 'Status'} role="table">
              <div class="row head" role="row">{#each b.table.head as h, j (j)}<span role="columnheader">{h}</span>{/each}</div>
              {#each b.table.rows as r, j (j)}
                <div class="row" role="row">{#each r as cell, k (k)}<span role="cell">{@render line(cell)}</span>{/each}</div>
              {/each}
            </div>
          {:else}
            <div class="flow">
              {#if __SEALED__}
                <svg role="img" aria-label="The sealed file runs in the browser and reads and writes only the team's folder; it has no connection to the internet." viewBox="0 0 760 210">
                  <rect x="10" y="62" width="200" height="70" rx="8" class="box dashed" />
                  <text x="110" y="92" class="b muted" text-anchor="middle">The internet</text>
                  <text x="110" y="112" class="s" text-anchor="middle">nothing, either way</text>
                  <path d="M218 84 L242 108 M242 84 L218 108" class="cross" />
                  {@render computer()}
                </svg>
              {:else}
                <svg role="img" aria-label="The website sends the app to the browser; the app reads and writes only the team's folder; nothing is sent back to the website." viewBox="0 0 760 210">
                  <rect x="10" y="62" width="200" height="70" rx="8" class="box" />
                  <text x="110" y="88" class="b" text-anchor="middle">The app's website</text>
                  <text x="110" y="108" class="s" text-anchor="middle">{HOST}</text>
                  <path d="M212 97 L246 97 M240 92 L248 97 L240 102" class="arrow grey" />
                  <text x="110" y="156" class="s" text-anchor="middle">sends the app and speech models</text>
                  <text x="110" y="172" class="s" text-anchor="middle">receives nothing back</text>
                  {@render computer()}
                </svg>
              {/if}
            </div>
          {/if}
        {/each}
      </section>
    {/each}
  </main>
</div>

{#snippet computer()}
  <rect x="250" y="20" width="300" height="170" rx="12" class="box" />
  <text x="268" y="44" class="b">Your computer</text>
  <rect x="280" y="62" width="240" height="70" rx="8" class="box app" />
  <text x="400" y="90" class="b blue" text-anchor="middle">Chrome or Edge: the app</text>
  <text x="400" y="110" class="s" text-anchor="middle">scripts are only ever here</text>
  <text x="400" y="164" class="s muted" text-anchor="middle">+ what the browser keeps (below)</text>
  <rect x="590" y="62" width="160" height="70" rx="8" class="box" />
  <text x="670" y="90" class="b" text-anchor="middle">The team's folder</text>
  <text x="670" y="110" class="s muted" text-anchor="middle">network drive</text>
  <path d="M522 88 L586 88 M580 83 L588 88 L580 93" class="arrow" />
  <path d="M588 106 L524 106 M530 101 L522 106 L530 111" class="arrow" />
  <text x="555" y="150" class="s" text-anchor="middle">read and write</text>
{/snippet}

<style>
  header { display: flex; align-items: center; gap: 8px; padding: 12px 24px; border-bottom: 1px solid var(--line); }
  header h1 { flex: 1; margin: 0; font-size: 15px; font-weight: 600; }
  .back { margin-left: -12px; }
  .print { min-height: 36px; padding: 0 12px; font-size: 13px; font-weight: 400; }
  .page { display: flex; gap: 32px; max-width: 1080px; margin: 0 auto; padding: 28px 24px 96px; }
  nav { flex: none; width: 200px; position: sticky; top: 24px; align-self: flex-start; display: flex; flex-direction: column; gap: 2px; }
  .nav-title { padding: 0 10px 6px; font-size: 12px; font-weight: 600; color: var(--muted); }
  nav button { min-height: 32px; padding: 6px 10px; border: 0; border-radius: 6px; background: none; color: #3d3d3d; font-size: 13px; font-weight: 400; text-align: left; }
  nav button:hover { background: #f5f5f5; }
  nav button.on { background: #eef2fc; color: #22479f; font-weight: 500; }
  main { flex: 1; min-width: 0; font-size: 14px; line-height: 1.6; }
  .title { margin: 0 0 6px; font-size: 22px; }
  .lead { margin: 0 0 4px; color: #3d3d3d; }
  .meta { margin: 0 0 8px; font-size: 12px; color: var(--muted); }
  section h2 { margin: 24px 0 8px; font-size: 16px; font-weight: 600; scroll-margin-top: 20px; }
  section p, section ul { margin: 0 0 10px; font-size: 13px; color: #3d3d3d; }
  section ul { padding-left: 20px; font-size: 14px; }
  code { font: 12px ui-monospace, Consolas, monospace; background: #f5f5f5; padding: 1px 4px; border-radius: 4px; overflow-wrap: anywhere; }
  a { color: var(--accent); }
  .table { margin: 0 0 10px; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; font-size: 13px; }
  .row { display: grid; grid-template-columns: minmax(150px, 1.1fr) 2fr; gap: 12px; padding: 9px 14px; border-top: 1px solid #eee; }
  .table.three .row { grid-template-columns: minmax(150px, 1.1fr) 2fr minmax(110px, 0.9fr); }
  .table.status .row { grid-template-columns: minmax(150px, 1.1fr) 110px 2fr; } /* the ASVS table: a short status in the middle */
  .row.head { border-top: 0; background: #f5f5f5; font-weight: 600; color: #3d3d3d; }
  .row span { min-width: 0; color: #3d3d3d; }
  .row span:first-child { color: var(--ink, #141414); }
  .checks { margin: 0 0 10px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .checks li { padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; }
  .checks h3 { margin: 0 0 2px; font-size: 14px; font-weight: 500; }
  .checks p { margin: 0; overflow-wrap: anywhere; }
  .flow { margin: 0 0 8px; padding: 18px; border: 1px solid var(--line); border-radius: 10px; background: #fafafa; }
  .flow svg { display: block; width: 100%; height: auto; font-family: inherit; }
  .box { fill: #fff; stroke: #bfbfbf; stroke-width: 1.5; }
  .box.dashed { stroke-dasharray: 5 4; }
  .box.app { fill: #eef2fc; stroke: #2a5bd7; }
  .b { font-size: 13px; font-weight: 600; fill: #141414; }
  .s { font-size: 11.5px; fill: #3d3d3d; }
  .muted { fill: #5f5f5f; }
  .blue { fill: #22479f; }
  .arrow { stroke: #2a5bd7; stroke-width: 2; fill: none; }
  .arrow.grey { stroke: #5f5f5f; }
  .cross { stroke: #b42318; stroke-width: 2; }
  @media (max-width: 760px) {
    .page { flex-direction: column; gap: 16px; }
    nav { position: static; width: auto; }
    .row, .table.three .row, .table.status .row { grid-template-columns: 1fr; gap: 2px; }
  }
  @media print {
    header, nav { display: none; }
    .page { display: block; max-width: none; padding: 0; }
    section { break-inside: avoid-page; }
    a { color: inherit; }
  }
</style>
