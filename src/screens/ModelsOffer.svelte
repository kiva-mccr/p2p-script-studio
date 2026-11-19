<script lang="ts" module>
  // Kept across screens: picking a folder swaps Open your scripts folder for the list, and the card stays as it was.
  let step = $state<'unknown' | 'hidden' | 'offer' | 'checking' | 'added'>('unknown');
</script>

<script lang="ts">
  // The speech models offered on the sealed app's first open (#327, board 92): a card in the page, once on this
  // computer, only when no models are kept. Not now or an import closes it for good; Settings › Speech models stays.
  import { onMount } from 'svelte';
  import lock from '../lib/models.lock.json';
  import { MODELS_ZIP, type ModelsLock } from '../lib/modelfiles';
  import { addModels, markModelsOffered, shouldOfferModels } from '../lib/sealedmodels';

  let progress = $state('');
  let problem = $state('');
  const mb = Math.round(Object.values(lock as ModelsLock).flatMap((m) => Object.values(m.files)).reduce((n, f) => n + f.bytes, 0) / 1e6);

  onMount(async () => {
    if (step !== 'unknown') return;
    step = 'hidden';
    if (!(await shouldOfferModels())) return;
    step = 'offer';
    await markModelsOffered(); // shown once: closing the window counts too
  });

  async function add(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    problem = '';
    step = 'checking';
    problem = await addModels(file, (done, of) => (progress = `Checking file ${done} of ${of}…`));
    progress = '';
    step = problem ? 'offer' : 'added';
  }
</script>

{#if step !== 'hidden' && step !== 'unknown'}
  <div class="offer" role="region" aria-label="Speech models">
    {#if step === 'added'}
      <p class="line"><b>Speech models added.</b> Follow my voice and cuts timed from the take work offline.</p>
      <div class="buttons"><button class="outline small" onclick={() => (step = 'hidden')}>Close</button></div>
    {:else if step === 'checking'}
      <p class="line" role="status">{progress || 'Reading the zip…'}</p>
    {:else}
      <b>Add the speech models?</b>
      <p class="line">Follow my voice and cuts timed from your takes need the speech models file you downloaded with the
        app ({MODELS_ZIP}, about {mb} MB).</p>
      <div class="buttons">
        <label class="primary small file">Import the models file…<input type="file" accept=".zip" onchange={add} /></label>
        <button class="outline small" onclick={() => (step = 'hidden')}>Not now</button>
      </div>
      {#if problem}<p class="bad" role="alert">{problem}</p>{/if}
      <p class="hint help">This card won't show again. You can import them later in Settings › Speech models.</p>
    {/if}
  </div>
{/if}

<style>
  .offer { display: flex; flex-direction: column; gap: 10px; width: min(560px, calc(100% - 32px)); box-sizing: border-box;
    margin: 8px auto 0; padding: 16px; border: 1px solid #c9d5f2; border-radius: 10px; background: #eef2fb;
    font-size: 14px; line-height: 1.5; }
  .offer b { font-weight: 600; }
  .line { margin: 0; color: #3d3d3d; }
  .buttons { display: flex; flex-wrap: wrap; gap: 8px; }
  .small { min-height: 36px; padding: 0 14px; font-size: 13px; }
  .file { display: inline-flex; align-items: center; cursor: pointer; position: relative; }
  .file input { position: absolute; width: 1px; height: 1px; opacity: 0; }
  .outline { background: #fff; }
  .hint { margin: 0; font-size: 12px; color: var(--muted); }
  .bad { margin: 0; font-size: 13px; color: var(--danger); }
</style>
