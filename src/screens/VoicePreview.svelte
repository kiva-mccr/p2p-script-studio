<script lang="ts">
  // Export > Voice-over's preview (EX-11, #237 on board 86): the joined file's player, and every row with its take's
  // waveform. While it plays, the row being heard is lit, scrolled into view, and its waveform fills in.
  import { clock } from '../lib/readtime.svelte';
  import type { Row } from '../lib/script';
  import type { Clip } from '../lib/voiceexport';
  import { peaksOf, wavePath } from '../lib/waveform';

  // rows: the script's rows. lined: the clips in the file, in order. sound: the file's URL.
  let { rows, lined, gap, rate, sound }: { rows: Row[]; lined: Clip[]; gap: number; rate: number; sound: string } = $props();

  const BARS = 60;
  let audio = $state<HTMLAudioElement>();
  let now = $state(0);
  let playing = $state(false);

  // Where each lined-up clip starts in the joined file, in seconds.
  const starts = $derived.by(() => {
    const out: number[] = [];
    let at = 0;
    for (const clip of lined) {
      out.push(at);
      at += clip.samples.length / rate + gap;
    }
    return out;
  });
  // Each take's waveform (a silent row has none: a flat line).
  const waves = $derived(lined.map((c) => (c.silent ? '' : wavePath(peaksOf(c.samples, BARS)))));
  // The clip being heard (none in a pause, before playing, or after the end).
  const lit = $derived(playing || now > 0 ? starts.findIndex((s, i) => now >= s && now < s + lined[i].samples.length / rate) : -1);

  // The time, followed every frame while playing so the fill moves smoothly.
  $effect(() => {
    const a = audio;
    if (!a) return;
    let frame = 0;
    const tick = () => {
      now = a.currentTime;
      playing = !a.paused;
      if (playing) frame = requestAnimationFrame(tick);
    };
    const start = () => (cancelAnimationFrame(frame), tick());
    const events = ['play', 'pause', 'seeked', 'timeupdate', 'ended', 'emptied'];
    for (const e of events) a.addEventListener(e, start);
    return () => {
      cancelAnimationFrame(frame);
      for (const e of events) a.removeEventListener(e, start);
    };
  });

  let list = $state<HTMLOListElement>();
  $effect(() => {
    if (lit < 0 || !playing) return;
    list?.querySelector('li.lit')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  function from(i: number) {
    if (!audio) return;
    audio.currentTime = starts[i];
    audio.play().catch(() => {});
  }
</script>

<div class="voice">
  <audio bind:this={audio} src={sound} controls></audio>
  <ol bind:this={list}>
    {#each rows as row, r (row.id)}
      {@const i = lined.findIndex((c) => c.row === r + 1)}
      {#if i > 0 && gap}<li class="pause"><span></span><span>pause</span><span></span><span></span><span>{gap}s</span></li>{/if}
      <li class:lit={i >= 0 && i === lit}>
        <span class="num">{r + 1}</span>
        {#if i >= 0}
          {@const seconds = lined[i].samples.length / rate}
          <button class="row" class:silent={lined[i].silent} onclick={() => from(i)}>{#if row.dialogue.trim()}<span data-hide>{row.dialogue.trim()}</span>{:else}(no dialogue){/if}</button>
          <span class="missing">{lined[i].silent ? 'no take yet, silence' : ''}</span>
          {@render wave(waves[i], i === lit ? (now - starts[i]) / seconds : null)}
          <span>{clock(seconds)}</span>
        {:else}
          <span class="left">{#if row.dialogue.trim()}<span data-hide>{row.dialogue.trim()}</span>{:else}(no dialogue){/if}</span>
          <span class="missing">no take yet, left out</span>
          {@render wave('', null)}
          <span class="left">–</span>
        {/if}
      </li>
    {/each}
  </ol>
</div>

<!-- A take's waveform; while its row is heard, the part played (`played`, 0 to 1) is filled in. A row with no take: a flat line. -->
{#snippet wave(path: string, played: number | null)}
  <span class="wave" class:on={played !== null} aria-hidden="true">
    {#if path}
      <svg viewBox="0 0 100 40" preserveAspectRatio="none"><path d={path} /></svg>
      {#if played !== null}<svg class="played" viewBox="0 0 100 40" preserveAspectRatio="none" style:clip-path="inset(0 {(100 - Math.min(1, Math.max(0, played)) * 100).toFixed(1)}% 0 0)"><path d={path} /></svg>{/if}
    {:else}
      <svg viewBox="0 0 100 40" preserveAspectRatio="none"><path d="M0 20H100" /></svg>
    {/if}
  </span>
{/snippet}

<style>
  .voice { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  audio { display: block; box-sizing: border-box; width: 100%; padding: 12px 16px; border-bottom: 1px solid var(--line); }
  ol { margin: 0; padding: 8px; list-style: none; font-size: 13px; }
  li { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto 120px 48px; gap: 12px; align-items: center; padding: 0 8px; border-radius: 6px; }
  li > :last-child { text-align: right; }
  li.lit { background: #eef3fd; }
  li.lit .row { font-weight: 600; }
  .num { color: var(--muted); }
  .row { min-height: 36px; padding: 0; border: 0; background: none; text-align: left; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row:hover { color: var(--accent); }
  .row.silent, .left { color: #8a5300; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .left { min-height: 36px; line-height: 36px; }
  .missing { font-size: 12px; color: #8a5300; }
  .pause { font-size: 12px; color: #8a8a8a; min-height: 20px; }
  .wave { position: relative; height: 22px; }
  .wave svg { position: absolute; inset: 0; width: 100%; height: 100%; }
  .wave path { fill: none; stroke: #c4c4c4; stroke-width: 1.2; vector-effect: non-scaling-stroke; }
  .wave.on path { stroke: #9db4e6; }
  .wave .played path { stroke: var(--accent); }
</style>
