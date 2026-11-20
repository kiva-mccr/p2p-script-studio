<script lang="ts">
  import { planLines } from '../lib/planning';
  import { renderMath, showLists, toHtml } from '../lib/format';

  // Notes shown with their formatting, one line each, tick box lines as real check boxes (RV-26, #248): Review's
  // plan, and the notes for the writer. Without `onflip` the boxes only show.
  let { text, onflip }: { text: string; onflip?: (line: number) => void } = $props();

  const lines = $derived(planLines(text));
  const line = (words: string) => toHtml(showLists(words));
  function math(node: HTMLElement, _lines: unknown) {
    renderMath(node);
    return { update: () => renderMath(node) };
  }
</script>

<div class="shown" data-hide use:math={lines}>
  {#each lines as l, i (i)}
    {#if l.tick !== undefined}
      <label class="tick" class:done={l.tick} class:still={!onflip}>
        <input type="checkbox" checked={l.tick} disabled={!onflip} onchange={() => onflip?.(i)} />
        <span>{@html line(l.text)}</span>
      </label>
    {:else if l.text.trim()}
      <p>{@html line(l.text)}</p>
    {:else}
      <p class="gap"></p>
    {/if}
  {/each}
</div>

<style>
  .shown p { margin: 0; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
  .shown .gap { height: 0.8em; }
  .shown :global(a) { color: var(--accent); }
  .tick { display: flex; align-items: flex-start; gap: 8px; min-height: 30px; line-height: 1.55; cursor: pointer; overflow-wrap: anywhere; }
  .tick.still { min-height: 0; cursor: default; }
  .tick input { flex: 0 0 auto; width: 16px; height: 16px; margin: 3px 0 0; accent-color: var(--accent); }
  .tick.done span { text-decoration: line-through; color: #6b6b6b; }
</style>
