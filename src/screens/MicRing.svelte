<script lang="ts">
  import { micRing, ringLabel, type Voice } from '../lib/micring';

  let { voice }: { voice: Voice } = $props();

  let ring = $derived(micRing(voice));
  let label = $derived(ring ? ringLabel(ring) : '');
  const R = 10; // the ring's radius, in a 24 × 24 box

  // The point a share of the way round the ring, clockwise from 12 o'clock.
  function at(share: number): string {
    const t = share * 2 * Math.PI - Math.PI / 2;
    return `${(12 + R * Math.cos(t)).toFixed(2)} ${(12 + R * Math.sin(t)).toFixed(2)}`;
  }
  const arc = ([from, to]: [number, number]) => `M${at(from)}A${R} ${R} 0 ${to - from > 0.5 ? 1 : 0} 1 ${at(to)}`;
</script>

{#if ring}
  <span class="ring" title={ring.missing.length ? label : 'Every row recorded'}><svg role="img" aria-label={label} width="22" height="22" viewBox="0 0 24 24" fill="none">
    <circle class="track" cx="12" cy="12" r={R}></circle>
    {#each ring.arcs as part, i (i)}
      {#if part[1] - part[0] > 0.9999}<circle class="done" cx="12" cy="12" r={R}></circle>{:else}<path class="done" d={arc(part)}></path>{/if}
    {/each}
    <g class="mic" stroke-width="1.6" stroke-linecap="round"><rect x="10" y="6" width="4" height="7" rx="2"></rect><path d="M8 11a4 4 0 0 0 8 0M12 15v2.5"></path></g>
  </svg></span>
{/if}

<style>
  .ring { flex: none; display: inline-flex; }
  .track { stroke: #f2c9c5; stroke-width: 2.5; }
  .done { stroke: #1f8a4c; stroke-width: 2.5; }
  .mic { stroke: #3d3d3d; }
</style>
