<script lang="ts">
  // Speech models in the sealed app (SE-5, board 89): Settings' section, in the sealed build only. The zip from the
  // Download sealed page is added once, checked file by file against the pinned SHA-256, and kept by the browser.
  import { addModels, forgetModels, keptModels, outdatedModels } from '../lib/sealedmodels';
  import { MODELS_ZIP } from '../lib/modelfiles';

  let status = $state<'none' | 'outdated' | 'added' | 'checking'>('none');
  let size = $state(0);
  let progress = $state('');
  let problem = $state('');

  async function look() {
    const kept = await keptModels();
    if (kept) ((status = 'added'), (size = kept.blob.size));
    else status = (await outdatedModels()) ? 'outdated' : 'none';
  }
  void look();

  async function add(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    problem = '';
    status = 'checking';
    problem = await addModels(file, (done, of) => (progress = `Checking file ${done} of ${of}…`));
    progress = '';
    await look();
  }

  async function remove() {
    await forgetModels();
    await look();
  }
</script>

<h3 class="next">Speech models</h3>
{#if status === 'added'}
  <p class="line">Added ({Math.round(size / 1e6)} MB). Follow my voice and cuts timed from the take work offline.
    <button class="outline small" onclick={remove}>Remove</button></p>
{:else if status === 'checking'}
  <p class="line" role="status">{progress || 'Reading the zip…'}</p>
{:else}
  <p class="line">{status === 'outdated' ? 'The models you added are for an older version.' : 'Not added.'}
    Follow my voice and cuts timed from the take need them.</p>
  <label class="outline small file">Add {MODELS_ZIP}…<input type="file" accept=".zip" onchange={add} /></label>
  <p class="hint help">Download it from the Download sealed page, beside this app. It's checked here, file by file, and
    kept in this browser.</p>
{/if}
{#if problem}<p class="bad" role="alert">{problem}</p>{/if}

<style>
  h3 { margin: 24px 0 12px; font-size: 13px; font-weight: 600; color: var(--muted); }
  .line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 14px; color: #3d3d3d; }
  .small { min-height: 36px; padding: 0 12px; font-size: 13px; }
  .file { display: inline-flex; align-items: center; cursor: pointer; }
  .file input { position: absolute; width: 1px; height: 1px; opacity: 0; }
  .hint { margin: 8px 0 0; font-size: 13px; line-height: 1.5; color: var(--muted); }
  .bad { margin: 8px 0 0; font-size: 13px; color: var(--danger); }
</style>
