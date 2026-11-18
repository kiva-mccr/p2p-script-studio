<script lang="ts">
  import { untrack } from 'svelte';
  import { isVideo } from '../lib/timeline';

  // The playing preview's picture(s) (issue #260): a cut put a new <img> or <video> in place of the old one, and
  // the browser showed nothing until it had decoded it, a flicker of black. Now each shot is a layer drawn over
  // the last one, unseen until its pictures are decoded (a video: its first frame), and only then does the old
  // layer go. paths: the pictures of the moment (two or more: a collage); urls: their blob URLs, by path.
  let { paths, urls, upright = false }: { paths: string[]; urls: Record<string, string>; upright?: boolean } = $props();

  type Layer = { id: number; key: string; paths: string[]; waiting: number; ready: boolean };
  let layers = $state<Layer[]>([]);
  let count = 0;
  const key = $derived(paths.map((p) => `${p}\n${urls[p] ?? ''}`).join('\n'));

  $effect(() => {
    const k = key;
    untrack(() => {
      if (layers.at(-1)?.key === k) return;
      const layer: Layer = { id: ++count, key: k, paths: [...paths], waiting: paths.filter((p) => urls[p]).length, ready: false };
      layers = [...layers, layer];
      if (!layer.waiting) show(layer.id);
    });
  });

  // A layer whose pictures are all ready shows, and the layers under it go.
  function show(id: number) {
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    layer.ready = true;
    layers = layers.filter((l) => l.id >= id);
  }

  // One picture of a layer is ready to be drawn: decoded, or a video's first frame there. A file that can't be
  // decoded counts as ready too, and none holds the old shot for more than a second.
  function ready(node: HTMLImageElement | HTMLVideoElement, id: number) {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const layer = layers.find((l) => l.id === id);
      if (layer && --layer.waiting <= 0) show(id);
    };
    if (node instanceof HTMLImageElement) node.decode().then(finish, finish);
    else if (node.readyState >= 2) finish();
    else {
      node.addEventListener('loadeddata', finish, { once: true });
      node.addEventListener('error', finish, { once: true });
    }
    const late = setTimeout(finish, 1000);
    return { destroy: () => { done = true; clearTimeout(late); } };
  }
</script>

{#each layers as layer (layer.id)}
  <div class="layer" class:waiting={!layer.ready} class:collage-on={layer.paths.length > 1} class:upright data-ready={layer.ready || undefined}>
    {#each layer.paths as path (path)}
      {#if isVideo(path) && urls[path]}
        <video src={urls[path]} autoplay muted playsinline use:ready={layer.id}></video>
      {:else if urls[path]}
        <img src={urls[path]} alt="" use:ready={layer.id} />
      {:else}
        <span class="vid">{path.split('/').at(-1)}</span>
      {/if}
    {/each}
  </div>
{/each}

<style>
  .layer { position: absolute; inset: 0; display: flex; gap: 3px; background: #0b0b0b; }
  .layer.waiting { opacity: 0; }
  .layer.collage-on { padding: 8% 6%; box-sizing: border-box; }
  .layer.upright { flex-direction: column; }
  .layer.upright.collage-on { padding: 6% 8%; }
  img, video, .vid { flex: 1; min-width: 0; min-height: 0; width: 100%; height: 100%; object-fit: contain; }
  .vid { display: flex; align-items: flex-end; box-sizing: border-box; padding: 4px; background: #2b2b2b; color: #eee; font-size: 10px; overflow: hidden; white-space: nowrap; }
</style>
