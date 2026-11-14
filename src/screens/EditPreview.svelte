<script lang="ts">
  // The Resolve / Premiere export's preview (EX-19, board 68): roughly how the editors' apps show the timeline once
  // opened (markers, V1 and any stacked tracks, A1 with the takes, C1 with captions), what the .zip holds, and how
  // to open it. Drawn from the same plan as the file.
  import { clock } from '../lib/readtime.svelte';
  import type { EditHow, Plan, Source } from '../lib/editxml';

  let { plan, how, name }: { plan: Plan; how: EditHow; name: string } = $props();

  const pct = (s: number) => (plan.total ? (s / plan.total) * 100 : 0);
  const ticks = $derived.by(() => {
    const step = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find((s) => plan.total / s <= 8) ?? 600;
    const list: number[] = [];
    for (let t = 0; t < plan.total - step / 3; t += step) list.push(t);
    return list;
  });
  const isCard = (n: string) => plan.media.get(n)?.kind === 'card';
  const label = (n: string) => {
    const s = plan.media.get(n);
    return s?.kind === 'card' ? `Card: ${s.text}` : n;
  };
  // Where each file in the media folder comes from, when it isn't a plain copy.
  const from = (s: Source) =>
    s.kind === 'png' ? '(from .svg)' : s.kind === 'collage' ? '(made side by side)' : s.kind === 'take' ? '(from the .webm take)' : s.kind === 'last' ? '(its last frame, for a hold)' : '';
  const files = $derived([...plan.media].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })));
</script>

<p class="caption">{name}.zip · {how.size.replace('x', ' × ')} · {how.fps} fps · {clock(plan.total)}</p>
{#if !plan.total}
  <p class="message" role="alert">The timeline is empty: write some dialogue or record a take first.</p>
{:else}
  <div class="box">
    <p class="small">Roughly how Resolve and Premiere show the timeline once it's opened</p>
    <div class="tracks">
      <span></span>
      <div class="ruler">{#each ticks as t (t)}<span style:left="{pct(t)}%">{clock(t)}</span>{/each}</div>
      {#if plan.markers.length}
        <span class="name">Marks</span>
        <div class="lane marks">{#each plan.markers as m (m.name)}<span class="mark" style:left="{pct(m.start)}%" title="{m.name}: {m.comment}">{m.name.replace('Row ', '')}</span>{/each}</div>
      {/if}
      {#each [...plan.video].reverse() as track, i (i)}
        <span class="name">V{plan.video.length - i}</span>
        <div class="lane">
          {#each track as item, j (j)}
            <span class="clip" class:card={isCard(item.name)} style:left="{pct(item.start)}%" style:width="{pct(item.seconds)}%" title="{label(item.name)} · {clock(item.seconds)}">{label(item.name)}</span>
          {/each}
        </div>
      {/each}
      <span class="name">A1</span>
      <div class="lane">
        {#each plan.audio as item (item.name)}
          <span class="clip take" style:left="{pct(item.start)}%" style:width="{pct(item.seconds)}%" title="{item.name} · {clock(item.seconds)}">{item.name.replace('.wav', '')}</span>
        {/each}
      </div>
      {#if plan.captions.length}
        <span class="name">C1</span>
        <div class="lane short">
          {#each plan.captions as c, j (j)}<span class="clip words" style:left="{pct(c.start)}%" style:width="{pct(c.seconds)}%" title={c.text}>{c.text}</span>{/each}
        </div>
      {/if}
    </div>
    <p class="small help">The same timings as the storyboard timeline under the script: each take's length, the read time where there's no take, holds and placeholders.</p>
  </div>

  <div class="pair">
    <div class="box">
      <h3>In the .zip</h3>
      <ul class="list">
        <li>{name}.xml</li>
        {#if plan.captions.length}<li>{name}.srt</li>{/if}
        <li>media/</li>
        {#each files as [file, source] (file)}<li class="in">{file} <span>{from(source)}</span></li>{/each}
      </ul>
    </div>
    <div class="box">
      <h3>Opening it</h3>
      <p class="help"><b>Resolve:</b> unzip, then File › Import › Timeline… and pick the .xml. Leave "Automatically import source clips" ticked.</p>
      <p class="help"><b>Premiere Pro:</b> unzip, then File › Import… and pick the .xml. If it asks where the media is, point to the media folder once.</p>
      {#each plan.links as l, i (i)}
        <p class="warn">Row {l.row}'s link ({l.label}) isn't in the zip: it's named in row {l.row}'s marker.</p>
      {/each}
    </div>
  </div>
{/if}

<style>
  .caption { margin: 0 0 8px; font-size: 13px; color: var(--muted); }
  .message { margin: 0; padding: 16px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; }
  .box { min-width: 0; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; font-size: 13px; line-height: 1.6; }
  .box + .pair, .pair { margin-top: 16px; }
  .pair { display: flex; flex-wrap: wrap; gap: 16px; }
  .pair > .box { flex: 1 1 260px; }
  .small { margin: 0 0 10px; font-size: 12px; color: var(--muted); }
  .small.help { margin: 10px 0 0; }
  .tracks { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 6px 8px; font-size: 11px; }
  .name { align-self: center; color: var(--muted); font-weight: 600; }
  .ruler { position: relative; height: 16px; color: var(--muted); border-bottom: 1px solid var(--line); }
  .ruler span, .mark, .clip { position: absolute; }
  .lane { position: relative; height: 40px; border-radius: 4px; background: #fafafa; }
  .lane.marks { height: 22px; background: none; }
  .lane.short { height: 24px; }
  .mark { top: 2px; padding: 1px 5px; border-radius: 3px; background: #fde7c7; color: #6b3d00; white-space: nowrap; }
  .clip { top: 0; bottom: 0; box-sizing: border-box; padding: 4px 6px; border: 1px solid #8faae6; border-radius: 4px; background: #cfddf8;
    color: #1c3a80; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .clip.card { border: 1px dashed #9a9a9a; background: #e9e9e9; color: #3d3d3d; }
  .clip.take { border-color: #7cc3a2; background: repeating-linear-gradient(90deg, #bfe3d2 0 2px, #ddf1e7 2px 4px); color: #0f4a31; }
  .clip.words { border-color: #c4c4c4; background: #fff; color: #3d3d3d; padding: 3px 6px; }
  h3 { margin: 0 0 6px; font-size: 14px; font-weight: 600; }
  .list { margin: 0; padding: 0; list-style: none; font: 12.5px/1.8 ui-monospace, Menlo, monospace; color: #3d3d3d; }
  .list .in { padding-left: 2ch; }
  .list span { color: var(--muted); }
  .box p { margin: 0 0 8px; }
  .warn { color: #8a5300; }
</style>
