<script lang="ts">
  // The video export's preview (SB-3, board 70): one moment of the video, drawn by the same code that makes the file
  // (lib/video.ts `frame`), with the picture track's clips underneath to pick the moment. Once a video is made, it
  // plays here; a click on a clip goes back to the stills. While making: the progress and Stop.
  import type { Plan } from '../lib/editxml';
  import { clock } from '../lib/readtime.svelte';
  import type { Shape } from '../lib/timeline';
  import { FPS, frame, frameSize, megabytes, type VideoHow } from '../lib/video';

  let { plan, dir, shape, how, name, made, progress, onStop }: {
    plan: Plan; dir: FileSystemDirectoryHandle; shape: Shape; how: VideoHow; name: string;
    made: { url: string; mp4: boolean } | null; progress: number | null; onStop: () => void;
  } = $props();

  const size = $derived(frameSize(how.size, shape));
  const items = $derived(plan.video[0] ?? []);
  let at = $state(0); // the clip shown
  let watching = $state(true); // the made video, rather than the stills
  $effect(() => {
    if (made) watching = true;
  });
  const shown = $derived(Math.min(at, Math.max(0, items.length - 1)));
  const pct = (s: number) => (plan.total ? (s / plan.total) * 100 : 0);
  const label = (n: string) => {
    const source = plan.media.get(n);
    if (source?.kind === 'card') return source.text;
    if (source?.kind === 'collage') return 'Collage';
    return n;
  };

  // Drawn small (a third of the frame) so it's quick; cards and captions scale with it.
  let canvas = $state<HTMLCanvasElement>();
  $effect(() => {
    const item = items[shown];
    if (!canvas || !item || (made && watching)) return;
    canvas.width = Math.round(size.width / 3);
    canvas.height = Math.round(size.height / 3);
    // A moment just inside the clip, so a caption that starts with it shows.
    void frame(dir, plan, item.start + Math.min(0.5, item.seconds / 2), canvas).catch(() => {});
  });

  function pick(i: number) {
    at = i;
    watching = false;
  }
</script>

<p class="caption">{name}.{made && !made.mp4 ? 'webm' : 'mp4'} · {size.width} × {size.height} · {FPS} fps · {clock(plan.total)} · about {megabytes(plan.total, how.size)} MB</p>
<div class="box">
  <div class="screen" class:upright={shape === 'upright'}>
    {#if made && watching}
      <!-- svelte-ignore a11y_media_has_caption (the captions, if any, are in the picture) -->
      <video src={made.url} controls></video>
    {:else}
      <canvas bind:this={canvas} aria-label="Preview of the video at {clock(items[shown]?.start ?? 0)}"></canvas>
    {/if}
  </div>
  <div class="clips">
    {#each items as item, i (item.start + item.name)}
      {@const source = plan.media.get(item.name)}
      <button class="clip" class:card={source?.kind === 'card'} aria-pressed={!watching && i === shown} style:left="{pct(item.start)}%" style:width="{pct(item.seconds)}%"
        title="{clock(item.start)} to {clock(item.start + item.seconds)} · {label(item.name)}" onclick={() => pick(i)}>{label(item.name)}</button>
    {/each}
  </div>
  <p class="help">The same pictures and timings as the storyboard timeline at the bottom of Write. Click a block to see that moment{made ? '; the video you made plays above until you do' : ''}.</p>
</div>
{#if progress !== null}
  <div class="making" role="status">
    <div class="line"><b>Making the video… {Math.round(progress * 100)}%</b><button class="outline" onclick={onStop}>Stop</button></div>
    <div class="bar"><span style:width="{progress * 100}%"></span></div>
    <p class="help">Faster than playing it. You can keep working in another tab.</p>
  </div>
{/if}

<style>
  .caption { margin: 0 0 8px; font-size: 13px; color: var(--muted); }
  .box { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 16px; border: 1px solid var(--line); border-radius: 10px; }
  .screen { width: 100%; max-width: 720px; aspect-ratio: 16 / 9; background: #000; border-radius: 6px; overflow: hidden; }
  .screen.upright { width: 240px; aspect-ratio: 9 / 16; }
  canvas, video { display: block; width: 100%; height: 100%; }
  .clips { position: relative; width: 100%; height: 40px; }
  .clip { position: absolute; top: 2px; bottom: 2px; box-sizing: border-box; padding: 0 4px; border: 1px solid #b9cdf5; border-radius: 4px; background: #eef3fc;
    font-size: 11px; color: #1c3a80; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .clip.card { border: 1px dashed #9a9a9a; background: #e9e9e9; color: #3d3d3d; }
  .clip[aria-pressed='true'] { border: 2px solid var(--accent); background: #cfddf8; }
  .help { margin: 0; width: 100%; font-size: 12px; color: var(--muted); }
  .making { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; padding: 14px 16px; border: 1px solid var(--line); border-radius: 10px; font-size: 13px; }
  .line { display: flex; align-items: center; gap: 12px; }
  .line b { flex: 1; font-weight: 600; }
  .line button { min-height: 36px; padding: 0 12px; }
  .bar { height: 8px; border-radius: 999px; background: #ededed; overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--accent); }
</style>
