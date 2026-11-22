<script lang="ts">
  // The live level while recording (AU-11, board 97): a small bar beside "● Recording", grey too quiet, green good,
  // red too loud, with a tick holding the loudest moment for a second. The sums are lib/levelmeter.ts.
  import { held, LOUD, percent, QUIET, zone } from '../lib/levelmeter';

  let { level }: { level: () => number | null } = $props();

  let db = $state(-Infinity);
  let peak = $state({ db: -Infinity, at: 0 });
  $effect(() => {
    let frame = 0;
    const tick = () => {
      const now = level();
      if (now !== null) {
        db = now;
        peak = held(peak, now, performance.now());
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  });
</script>

<span class="meter {zone(db)}" role="meter" aria-label="Microphone level" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(percent(db))}
  style:--quiet="{percent(QUIET)}%" style:--loud="{percent(LOUD)}%">
  <span class="fill" style:width="{percent(db)}%"></span>
  {#if peak.db > -Infinity}<span class="tick" style:left="{Math.min(98, percent(peak.db))}%"></span>{/if}
</span>

<style>
  .meter {
    position: relative; display: inline-block; width: 160px; height: 8px; border-radius: 4px; overflow: hidden;
    background: linear-gradient(to right, #ececec 0 var(--quiet), #dcefe3 var(--quiet) var(--loud), #f8dcd6 var(--loud) 100%);
  }
  .fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: #8a8a8a; }
  .good .fill { background: #1f7a4d; }
  .loud .fill { background: #c2410c; }
  .tick { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--ink); }
</style>
