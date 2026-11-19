<script lang="ts">
  import { fitBox, readBox, startBox, type Box } from '../lib/floatbox';
  import { clock } from '../lib/readtime.svelte';
  import { keep, recall } from '../lib/remember';
  import PreviewShot from './PreviewShot.svelte';

  // The storyboard timeline's preview while playing (#226, board 85). Three places: docked in the open drawer, right
  // of the tracks; above the folded drawer's right end; or big (⤢), floating over the script, moved by its bar and
  // resized by its corner, where it was left kept in this browser (one box for wide, one for upright).
  let {
    paths, urls, card, placeholder, tag, time, total, upright, docked, drawer, end, big = $bindable(), onClose,
  }: {
    paths: string[]; urls: Record<string, string>;
    card: string; placeholder: boolean; tag: string; // a card in place of a picture; the label over it
    time: number; total: number; upright: boolean;
    docked: boolean; // in the open drawer, beside the tracks
    drawer: number; // the drawer's height, px: big stays above it
    end: () => number; // the drawer's right end, px from the window's left: big starts above it
    big: boolean;
    onClose: () => void;
  } = $props();

  const BAR = 40; // the big preview's bar, px
  const GAP = 12; // from the top bar, the drawer and the window's sides
  const ratio = $derived(upright ? 16 / 9 : 9 / 16);
  const key = $derived(upright ? 'timeline-preview-upright' : 'timeline-preview-wide');
  let vw = $state(innerWidth), vh = $state(innerHeight);
  let stamp = $state(0); // bumped when a box is kept, so `kept` reads it again
  const kept = $derived.by(() => (void stamp, readBox(recall(key))));
  const room = $derived.by(() => {
    const barH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--bar-h')) || 0;
    return { left: GAP, top: barH + GAP, right: vw - GAP, bottom: vh - drawer - GAP };
  });
  let live = $state<Box | null>(null); // while it's being moved or resized
  const box = $derived(fitBox(live ?? kept ?? startBox({ ...room, right: Math.min(room.right, end() - 16) }, ratio, BAR, upright ? 405 : 720), room, ratio, BAR));

  let held: { size: boolean; x: number; y: number; from: Box } | null = null;
  function press(e: PointerEvent, size: boolean) {
    if (e.button !== 0 || (!size && (e.target as Element).closest('button:not(.grip)'))) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    held = { size, x: e.clientX, y: e.clientY, from: box };
  }
  function drag(e: PointerEvent) {
    if (!held) return;
    const dx = e.clientX - held.x, dy = e.clientY - held.y, f = held.from;
    const by = Math.abs(dx) >= Math.abs(dy / ratio) ? dx : dy / ratio; // the corner follows whichever way it went further
    live = held.size ? { ...f, w: f.w + by } : { ...f, x: f.x + dx, y: f.y + dy };
  }
  const save = (b: Box) => (keep(key, JSON.stringify(b)), stamp++);
  function letGo() {
    if (!held) return;
    held = null;
    if (live) save(fitBox(live, room, ratio, BAR));
    live = null;
  }
  // From the keyboard: the grip's arrows move it, the corner's arrows resize it, 20 px a press.
  function nudge(e: KeyboardEvent, size: boolean) {
    const [dx, dy] = ({ ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] } as Record<string, number[]>)[e.key] ?? [0, 0];
    if (!dx && !dy) return;
    e.preventDefault();
    save(fitBox(size ? { ...box, w: box.w + dx - dy } : { ...box, x: box.x + dx, y: box.y + dy }, room, ratio, BAR));
  }
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />

{#snippet buttons()}
  <span class="time">{clock(time)} / {clock(total)}</span>
  <button aria-label={big ? 'Make the preview small' : 'Make the preview big'} title={big ? 'Make the preview small' : 'Make the preview big'} onclick={() => (big = !big)}>{big ? '⤡' : '⤢'}</button>
  <button aria-label="Close the preview" title="Close the preview" onclick={onClose}>✕</button>
{/snippet}

<div class="preview" class:big class:docked class:upright role="img" aria-label="Preview: {tag}"
  style:left={big ? `${box.x}px` : null} style:top={big ? `${box.y}px` : null} style:width={big ? `${box.w}px` : null}>
  {#if big}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="pbar move" onpointerdown={(e) => press(e, false)} onpointermove={drag} onpointerup={letGo} onpointercancel={letGo}>
      <button class="grip" aria-label="Move the preview" title="Drag to move (or use the arrow keys)" onkeydown={(e) => nudge(e, false)}>⠿</button>
      {@render buttons()}
    </div>
  {/if}
  <div class="screen">
    <PreviewShot {paths} {urls} {upright} />
    {#if card}<span class="pcard" class:ph={placeholder}>{card}</span>{/if}
    <span class="tag">{tag}</span>
  </div>
  {#if big}
    <button class="corner" aria-label="Resize the preview" title="Drag to resize (or use the arrow keys)"
      onpointerdown={(e) => press(e, true)} onpointermove={drag} onpointerup={letGo} onpointercancel={letGo} onkeydown={(e) => nudge(e, true)}></button>
  {:else}
    <div class="pbar">{@render buttons()}</div>
  {/if}
</div>

<style>
  .preview { border-radius: 10px; overflow: hidden; background: #0b0b0b; }
  /* Folded: above the drawer's right end, never taller than the room between the top bar and the drawer (less its
     12 px gap, a 12 px margin and the 40 px bar under the picture), so upright never runs off the top. */
  .preview:not(.docked):not(.big) { --room: calc(100vh - var(--bar-h, 0px) - var(--drawer, 0px) - 64px); position: absolute; right: 16px; bottom: calc(100% + 12px); width: min(320px, calc(var(--room) * 16 / 9)); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25); }
  .preview.upright:not(.docked):not(.big) { width: min(180px, calc(var(--room) * 9 / 16)); }
  /* Open: in the drawer, right of the tracks. */
  .docked { flex: none; align-self: flex-start; width: 220px; }
  .docked.upright { width: 140px; }
  /* Big: floating over the script, where it was left (left, top and width set from the kept box). */
  .big { position: fixed; z-index: 30; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3); }
  .upright .screen { aspect-ratio: 9 / 16; }
  .screen { position: relative; aspect-ratio: 16 / 9; display: flex; }
  .pcard { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; padding: 12px; color: #dadada; font-size: 13px; text-align: center; background: #222; }
  .pcard.ph { background: repeating-linear-gradient(135deg, #2b2b2b 0 10px, #333 10px 20px); }
  .tag { position: absolute; left: 8px; top: 8px; padding: 2px 6px; border-radius: 4px; background: rgba(0, 0, 0, 0.6); color: #fff; font-size: 11px; }
  .pbar { display: flex; align-items: center; gap: 6px; padding: 6px 8px; color: #dadada; font-size: 12px; font-variant-numeric: tabular-nums; }
  .pbar.move { box-sizing: border-box; height: 40px; cursor: move; touch-action: none; user-select: none; }
  /* The time never wraps: in a narrow preview it ellipsizes (a wrapped bar made the preview taller). */
  .time { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pbar button { flex: none; min-width: 32px; height: 28px; padding: 0; line-height: 1; border: 1px solid #555; border-radius: 6px; background: none; color: #eee; font-size: 12px; }
  .docked .pbar { gap: 4px; padding: 4px 6px; }
  .docked .pbar button { min-width: 28px; height: 26px; }
  .pbar .grip { border: 0; font-size: 15px; cursor: move; }
  /* The resize corner: a 24 px target in the bottom right, drawn as two short lines. */
  .corner { position: absolute; right: 0; bottom: 0; width: 24px; height: 24px; padding: 0; border: 0; background: none; cursor: nwse-resize; touch-action: none; }
  .corner::after { content: ''; position: absolute; right: 4px; bottom: 4px; width: 10px; height: 10px; border-right: 2px solid #eee; border-bottom: 2px solid #eee; }
</style>
