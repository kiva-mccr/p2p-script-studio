<script lang="ts">
  // The video export's preview (SB-3, board 70): one moment of the video, drawn by the same code that makes the file
  // (lib/video.ts `frame`), with the picture track's clips underneath to pick the moment. Once a video is made, it
  // plays here; a click on a clip goes back to the stills. While making: the progress and Stop.
  import type { Plan } from '../lib/editxml';
  import { assetFile } from '../lib/folder';
  import { makePreview, revokePreview } from '../lib/preview';
  import { clock } from '../lib/readtime.svelte';
  import type { Shape } from '../lib/timeline';
  import { frame, megabytes, videoBits, videoFps, videoFrame, type VideoHow } from '../lib/video';

  let { plan, dir, shape, how, name, made, progress, onStop }: {
    plan: Plan; dir: FileSystemDirectoryHandle; shape: Shape; how: VideoHow; name: string;
    made: { url: string; mp4: boolean } | null; progress: number | null; onStop: () => void;
  } = $props();

  // The frame as chosen (the last good one while a Custom box, #217, holds something that isn't a size or rate).
  let size = $state({ width: 1920, height: 1080 });
  let fps = $state(30);
  $effect.pre(() => {
    const s = videoFrame(how, shape);
    if (s) size = s;
    const f = videoFps(how);
    if (f) fps = f;
  });
  const fpsName = $derived(String(Math.round(fps * 1000) / 1000));
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

  // A tiny picture on each clip (#220, board 82), so a click reads as "see this one bigger": a picture's small copy,
  // a video's first frame (also for a hold after it), a collage's first picture. Made once per file, as Assets'
  // thumbnails are (two at a time), and freed when the preview goes or the files change.
  const thumbOf = (n: string): string | undefined => {
    const source = plan.media.get(n);
    if (source?.kind === 'copy' || source?.kind === 'png' || source?.kind === 'last') return source.path;
    if (source?.kind === 'collage') return source.paths[0];
  };
  const thumbPaths = $derived([...new Set(items.map((i) => thumbOf(i.name)).filter((p) => p !== undefined))].join('\n'));
  let thumbs = $state<Record<string, string>>({});
  $effect(() => {
    const list = thumbPaths ? thumbPaths.split('\n') : [];
    let gone = false;
    const made: string[] = [];
    (async () => {
      for (const path of list) {
        const file = await assetFile(dir, path);
        if (gone) return;
        const preview = file && (await makePreview(file, path));
        if (gone) return revokePreview(preview);
        const url = preview?.kind === 'video' ? preview.still : preview?.kind === 'image' || preview?.kind === 'tif' ? preview.url : undefined;
        if (preview?.kind === 'video') URL.revokeObjectURL(preview.url); // only the still is used
        else if (preview && !url) revokePreview(preview);
        if (!url) continue;
        made.push(url);
        thumbs = { ...thumbs, [path]: url };
      }
    })();
    return () => {
      gone = true;
      made.forEach((u) => URL.revokeObjectURL(u));
      thumbs = {};
    };
  });

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

<p class="caption"><span data-hide>{name}</span>.{made && !made.mp4 ? 'webm' : 'mp4'} · {size.width} × {size.height} · {fpsName} fps · {clock(plan.total)} · about {megabytes(plan.total, videoBits(how, size))} MB</p>
<div class="box">
  <div class="screen" style:aspect-ratio="{size.width} / {size.height}" style:width="min(100%, 720px, {Math.round((427 * size.width) / size.height)}px)">
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
        title="{clock(item.start)} to {clock(item.start + item.seconds)} · {label(item.name)}" onclick={() => pick(i)}>
        <span class="in">
          {#if source?.kind === 'card'}<span class="thumb grey"></span>{:else if thumbs[thumbOf(item.name) ?? '']}<img class="thumb" src={thumbs[thumbOf(item.name) ?? '']} alt="" />{/if}
          <span class="name">{#if source?.kind === 'collage'}{label(item.name)}{:else}<span data-hide>{label(item.name)}</span>{/if}</span>
        </span>
      </button>
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
  .screen { background: #000; border-radius: 6px; overflow: hidden; } /* sized by the frame's shape: at most 720 wide, 427 high */
  canvas, video { display: block; width: 100%; height: 100%; }
  /* Many clips (#220): each is a size container, so a narrow one shows its picture alone, a sliver drops it, then its padding; a clip too narrow
     for its own border can't push past the row's ends (overflow-x: clip, which keeps focus rings above and below). */
  .clips { position: relative; width: 100%; height: 40px; overflow-x: clip; overflow-clip-margin: 3px; }
  .clip { position: absolute; top: 2px; bottom: 2px; box-sizing: border-box; padding: 0; min-width: 0; border: 1px solid #b9cdf5; border-radius: 4px; background: #eef3fc;
    font-size: 11px; color: #1c3a80; text-align: left; white-space: nowrap; overflow: hidden; container-type: inline-size; }
  .in { display: flex; align-items: center; gap: 5px; height: 100%; padding: 3px; box-sizing: border-box; }
  .thumb { flex: 0 0 auto; width: 40px; max-width: 100%; height: 100%; border-radius: 3px; object-fit: cover; background: #dfe5ee; }
  .thumb.grey { background: #9a9a9a; }
  .name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  @container (max-width: 64px) { .thumb + .name { display: none; } } /* narrow: the picture alone (its name is in the hover text) */
  @container (max-width: 20px) { .thumb { display: none; } .thumb + .name { display: inline; } }
  @container (max-width: 12px) { .in { padding: 0; } }
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
