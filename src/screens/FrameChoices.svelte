<script lang="ts">
  // Frame size and frames per second for the Resolve / Premiere and the video exports, each ending with "Custom"
  // (#217, board 86): picking it shows a box beside it for your own rate, or width × height with its shape.
  import type { Snippet } from 'svelte';
  import type { Fps } from '../lib/editxml';
  import { FPS_RANGE, SIDE_RANGE, frameRate, readFps, readSide, shapeName, type Own } from '../lib/framing';

  type How = Own & { size: string; fps: Fps | 'custom' };
  let { how = $bindable(), sizes, rates, group, whole = false, underSize }: {
    how: How; sizes: { id: string; name: string }[]; rates: Fps[]; group: string;
    whole?: boolean; // the file counts whole frames (FCP7 XML): say when a typed rate is rounded
    underSize?: Snippet;
  } = $props();

  const width = $derived(readSide(how.ownWidth));
  const height = $derived(readSide(how.ownHeight));
  const fps = $derived(readFps(how.ownFps));
</script>

<fieldset class="plain">
  <legend>Frame size</legend>
  <div class="rates">
    {#each sizes as s (s.id)}<label><input type="radio" name="{group}-size" checked={how.size === s.id} onchange={() => (how.size = s.id)} /> {s.name}</label>{/each}
    <label><input type="radio" name="{group}-size" checked={how.size === 'custom'} onchange={() => (how.size = 'custom')} /> Custom</label>
    {#if how.size === 'custom'}
      <span class="own">
        <input type="text" inputmode="numeric" aria-label="Width" aria-invalid={!width} bind:value={how.ownWidth} /> ×
        <input type="text" inputmode="numeric" aria-label="Height" aria-invalid={!height} bind:value={how.ownHeight} />
        {#if width && height}<span class="note">{shapeName(width, height)}</span>
        {:else}<span class="note wrong">{SIDE_RANGE[0]} to {SIDE_RANGE[1]} pixels</span>{/if}
      </span>
    {/if}
  </div>
  {@render underSize?.()}
</fieldset>
<fieldset class="plain">
  <legend>Frames per second</legend>
  <div class="rates">
    {#each rates as r (r)}<label><input type="radio" name="{group}-fps" checked={how.fps === r} onchange={() => (how.fps = r)} /> {r}</label>{/each}
    <label><input type="radio" name="{group}-fps" checked={how.fps === 'custom'} onchange={() => (how.fps = 'custom')} /> Custom</label>
    {#if how.fps === 'custom'}
      <span class="own">
        <input type="text" inputmode="decimal" class="rate" aria-label="Your own frame rate" aria-invalid={!fps} bind:value={how.ownFps} /> fps
        <span class="note" class:wrong={!fps}>({FPS_RANGE[0]} to {FPS_RANGE[1]})</span>
      </span>
    {/if}
  </div>
  {#if how.fps === 'custom' && whole && fps && frameRate(fps).rounded}
    <p class="note">Resolve and Premiere count whole frames: written as {frameRate(fps).timebase} fps.</p>
  {/if}
</fieldset>

<style>
  fieldset { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0; border: 0; }
  legend { padding: 0; margin-bottom: 4px; font-size: 12px; color: var(--muted); }
  .rates { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; }
  label { display: flex; align-items: center; gap: 8px; min-height: 32px; }
  .own { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
  .own input { box-sizing: border-box; width: 60px; min-height: 30px; padding: 0 8px; border: 1px solid var(--accent); border-radius: 6px; font: inherit; }
  .own input.rate { width: 72px; }
  .own input[aria-invalid='true'] { border-color: #b3261e; }
  .note { margin: 0; font-size: 12px; color: var(--muted); }
  .note.wrong { color: #b3261e; }
</style>
