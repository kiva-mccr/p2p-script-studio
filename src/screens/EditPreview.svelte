<script lang="ts">
  // The Resolve / Premiere export's preview (EX-19, board 68; zoom, board 79): roughly how the editors' apps show the
  // timeline once opened (sections, a pin per marker, V1 and any stacked tracks, A1 with the takes, C1 with captions),
  // what the .zip holds, and how to open it. Drawn from the same plan as the file.
  import { clock } from '../lib/readtime.svelte';
  import { editFps, editFrame, type EditHow, type Plan, type Source } from '../lib/editxml';
  import { FOLD_FROM, numberRuns } from '../lib/numberruns';

  let { plan, how, name }: { plan: Plan; how: EditHow; name: string } = $props();

  // Zoom (#254, board 79): − and + as on the storyboard timeline, 1× to 16×; the tracks scroll sideways in their box.
  let zoom = $state(1);
  let laneWidth = $state(0); // the visible width of the tracks, in px
  const pct = (s: number) => (plan.total ? (s / plan.total) * 100 : 0);
  const px = (s: number) => (plan.total ? (s / plan.total) * laneWidth * zoom : 0);
  // A clip's name shows only where about ten letters (or the whole name) fit; otherwise it's a plain block.
  const fits = (s: number, text: string) => px(s) - 14 >= Math.min(text.length, 10) * 6;
  // A 1 px gap after each clip, so the rounded boxes never run into each other; very short ones stay 3 px wide.
  const width = (s: number) => `max(3px, calc(${pct(s)}% - 1px))`;
  const ticks = $derived.by(() => {
    const step = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find((s) => plan.total / s <= 8 * zoom) ?? 600;
    const list: number[] = [];
    for (let t = 0; t < plan.total - step / 3; t += step) list.push(t);
    return list;
  });
  const isCard = (n: string) => plan.media.get(n)?.kind === 'card';
  // A file named after one of the script's (a copy, a drawn .svg, a video's last frame) is covered in Feedback's
  // picture; the app's own (take-1.wav, row-2-collage.png) are not.
  const own = (n: string) => ['copy', 'png', 'last'].includes(plan.media.get(n)?.kind ?? '');
  const label = (n: string) => {
    const s = plan.media.get(n);
    return s?.kind === 'card' ? `Card: ${s.text}` : n;
  };
  // Where each file in the media folder comes from, when it isn't a plain copy (`many`: said of a folded run).
  const from = (s: Source, many = false) =>
    s.kind === 'png' ? '(from .svg)' : s.kind === 'collage' ? '(made side by side)' : s.kind === 'take' ? `(from the .webm ${many ? 'takes' : 'take'})` : s.kind === 'last' ? (many ? '(their last frames, for holds)' : '(its last frame, for a hold)') : '';
  const files = $derived([...plan.media].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })));
  // Numbered files folded together (#255, board 86): three or more that differ only by a number show first ↓ last;
  // a click unfolds them. Kept open by the run's first name.
  const runs = $derived(numberRuns(files, ([f]) => f, ([, a], [, b]) => from(a) === from(b)));
  let unfolded = $state<Record<string, boolean>>({});
  // The size and rate as chosen; left out of the line while a Custom box (#217) isn't one.
  const frame = $derived(editFrame(how));
  const fps = $derived(editFps(how));
</script>

<p class="caption"><span data-hide>{name}</span>{[`.zip`, frame && `${frame.width} × ${frame.height}`, fps && `${fps} fps`, clock(plan.total)].filter(Boolean).join(' · ')}</p>
{#if !plan.total}
  <p class="message" role="alert">The timeline is empty: write some dialogue or record a take first.</p>
{:else}
  <div class="box">
    <div class="top">
      <p class="small">Roughly how Resolve and Premiere show the timeline once it's opened</p>
      <span class="zoom" role="group" aria-label="Zoom">
        <button aria-label="Zoom out" title="Zoom out" disabled={zoom <= 1} onclick={() => (zoom = Math.max(1, zoom / 2))}>−</button>
        <button aria-label="Zoom in" title="Zoom in" disabled={zoom >= 16} onclick={() => (zoom = Math.min(16, zoom * 2))}>+</button>
        <span class="times">{zoom}×</span>
      </span>
    </div>
    <div class="tracks">
      <div class="names">
        <span class="h-ruler"></span>
        {#if plan.sections.length}<span class="name h-sections">Sections</span>{/if}
        {#if plan.markers.length}<span class="name h-marks">Marks</span>{/if}
        {#each plan.video as _, i (i)}<span class="name h-lane">V{plan.video.length - i}</span>{/each}
        <span class="name h-lane">A1</span>
        {#if plan.captions.length}<span class="name h-short">C1</span>{/if}
      </div>
      <div class="scroll" bind:clientWidth={laneWidth}>
        <div class="lanes" style:width="{zoom * 100}%">
          <div class="ruler h-ruler">{#each ticks as t (t)}<span style:left="{pct(t)}%">{clock(t)}</span>{/each}</div>
          {#if plan.sections.length}
            <div class="lane h-sections">
              {#each plan.sections as g (g.start)}
                <span class="section" style:left="{pct(g.start)}%" style:width="calc({pct(g.seconds)}% - 2px)" title="{g.title} · from row {g.row} at {clock(g.start)}"><span data-hide>{g.title}</span></span>
              {/each}
            </div>
          {/if}
          {#if plan.markers.length}
            <div class="lane h-marks">{#each plan.markers as m (m.name)}<span class="pin" style:left="calc({pct(m.start)}% + 1px)" title="{m.name} at {clock(m.start)}"></span>{/each}</div>
          {/if}
          {#each [...plan.video].reverse() as track, i (i)}
            <div class="lane h-lane">
              {#each track as item, j (j)}
                {@const text = label(item.name)}
                {@const show = fits(item.seconds, text)}
                <span class="clip" class:card={isCard(item.name)} class:bare={!show} class:tiny={px(item.seconds) < 10} style:left="{pct(item.start)}%" style:width={width(item.seconds)} title="{text} · {clock(item.seconds)}">{#if show}{#if isCard(item.name)}Card: <span data-hide>{text.slice(6)}</span>{:else}{@render fileName(item.name)}{/if}{/if}</span>
              {/each}
            </div>
          {/each}
          <div class="lane h-lane">
            {#each plan.audio as item, j (item.name)}
              {@const text = item.name.replace('.wav', '')}
              {@const show = fits(item.seconds, text)}
              <span class="clip take" class:odd={j % 2 === 1} class:bare={!show} class:tiny={px(item.seconds) < 10} style:left="{pct(item.start)}%" style:width={width(item.seconds)} title="{item.name} · {clock(item.seconds)}">{show ? text : ''}</span>
            {/each}
          </div>
          {#if plan.captions.length}
            <div class="lane h-short">
              {#each plan.captions as c, j (j)}{@const show = fits(c.seconds, c.text)}<span class="clip words" class:bare={!show} class:tiny={px(c.seconds) < 10} style:left="{pct(c.start)}%" style:width={width(c.seconds)} title={c.text}>{#if show}<span data-hide>{c.text}</span>{/if}</span>{/each}
            </div>
          {/if}
        </div>
      </div>
    </div>
    <p class="small help">The same timings as the storyboard timeline at the bottom of Write. Zoom in with + to read the names, and hover over a block or pin for its name and time.</p>
  </div>

  <div class="pair">
    <div class="box">
      <h3>In the .zip</h3>
      <ul class="list">
        <li><span data-hide>{name}</span>.xml</li>
        {#if plan.captions.length}<li><span data-hide>{name}</span>.srt</li>{/if}
        <li>media/</li>
        {#each runs as run (run[0][0])}
          {@const first = run[0][0]}
          {#if run.length < FOLD_FROM}
            {#each run as [file, source] (file)}<li class="in">{@render fileName(file)} <span>{from(source)}</span></li>{/each}
          {:else}
            {@const open = !!unfolded[first]}
            <li class="in">
              <button class="run" aria-expanded={open} title={open ? 'Fold these files' : 'Show every file'} onclick={() => (unfolded[first] = !open)}>
                {#if open}
                  {#each run as [file, source] (file)}<span class="line">{@render fileName(file)} <span>{from(source)}</span></span>{/each}
                {:else}
                  <span class="line">{@render fileName(first)}</span>
                  <span class="line more">↓ <b>{run.length} files</b></span>
                  <span class="line">{@render fileName(run.at(-1)![0])} <span>{from(run[0][1], true)}</span></span>
                {/if}
              </button>
            </li>
          {/if}
        {/each}
      </ul>
    </div>
    <div class="box">
      <h3>Opening it</h3>
      <p class="help"><b>Resolve:</b> unzip, then File › Import › Timeline… and pick the .xml. Leave "Automatically import source clips" ticked.</p>
      <p class="help"><b>Premiere Pro:</b> unzip, then File › Import… and pick the .xml. If it asks where the media is, point to the media folder once.</p>
      {#each plan.links as l, i (i)}
        <p class="warn">Row {l.row}'s link (<span data-hide>{l.label}</span>) isn't in the zip: it's named in row {l.row}'s marker.</p>
      {/each}
    </div>
  </div>
{/if}


{#snippet fileName(file: string)}{#if own(file)}<span data-hide>{file}</span>{:else}{file}{/if}{/snippet}

<style>
  .caption { margin: 0 0 8px; font-size: 13px; color: var(--muted); }
  .message { margin: 0; padding: 16px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; }
  .box { min-width: 0; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; font-size: 13px; line-height: 1.6; }
  .box + .pair, .pair { margin-top: 16px; }
  .pair { display: flex; flex-wrap: wrap; gap: 16px; }
  .pair > .box { flex: 1 1 260px; }
  .small { margin: 0 0 10px; font-size: 12px; color: var(--muted); }
  .small.help { margin: 10px 0 0; }
  .top { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 0 0 10px; }
  .top .small { flex: 1 1 300px; margin: 0; }
  .zoom { display: inline-flex; align-items: center; gap: 4px; }
  .zoom button { width: 32px; height: 32px; border: 1px solid var(--line-strong); border-radius: 6px; background: #fff; font-size: 15px; }
  .zoom button:disabled { opacity: 0.4; }
  .times { min-width: 28px; font-size: 12px; color: var(--muted); }
  .tracks { display: grid; grid-template-columns: 58px minmax(0, 1fr); gap: 0 8px; font-size: 11px; }
  .names, .lanes { display: flex; flex-direction: column; gap: 6px; }
  .scroll { overflow-x: auto; padding-bottom: 6px; }
  .lanes { position: relative; }
  .h-ruler { height: 16px; } .h-sections { height: 22px; } .h-marks { height: 14px; } .h-lane { height: 40px; } .h-short { height: 24px; }
  .name { display: flex; align-items: center; color: var(--muted); font-weight: 600; }
  .ruler { position: relative; overflow: hidden; box-sizing: border-box; color: var(--muted); border-bottom: 1px solid var(--line); }
  .ruler span { white-space: nowrap; }
  .ruler span, .section, .pin, .clip { position: absolute; }
  .lane { position: relative; flex: none; overflow: hidden; border-radius: 4px; background: #fafafa; }
  .lane.h-sections, .lane.h-marks { background: none; }
  .section { top: 0; bottom: 0; box-sizing: border-box; padding: 3px 6px; border-left: 2px solid #e89a3c; border-radius: 0 3px 3px 0; background: #fde7c7;
    color: #6b3d00; font-weight: 500; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .pin { top: 0; bottom: 0; width: 2px; margin-left: -1px; border-radius: 1px; background: #e89a3c; }
  .clip { top: 0; bottom: 0; box-sizing: border-box; padding: 4px 6px; border: 1px solid #8faae6; border-radius: 4px; background: #cfddf8;
    color: #1c3a80; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .clip.tiny { border-radius: 2px; }
  .clip.card { border: 1px dashed #9a9a9a; background: #e9e9e9; color: #3d3d3d; }
  .clip.take { padding: 3px 6px; border-color: #5fb08a; background: #d6efe2; color: #0f4a31; }
  .clip.take.odd { background: #bfe3d2; }
  .clip.words { border-color: #c4c4c4; background: #fff; color: #3d3d3d; padding: 3px 6px; }
  .clip.bare { padding: 0; }
  h3 { margin: 0 0 6px; font-size: 14px; font-weight: 600; }
  .list { margin: 0; padding: 0; list-style: none; font: 12.5px/1.8 ui-monospace, Menlo, monospace; color: #3d3d3d; }
  .list .in { padding-left: 2ch; }
  .list span { color: var(--muted); }
  .run { display: block; padding: 0; border: 0; background: none; font: inherit; color: inherit; text-align: left; cursor: pointer; }
  .run .line { display: block; color: inherit; }
  .run .more { padding-left: 2ch; }
  .run b { font-weight: inherit; color: #2a5bd7; }
  .box p { margin: 0 0 8px; }
  .warn { color: #8a5300; }
</style>
