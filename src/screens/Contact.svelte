<script lang="ts">
  import { problem } from '../lib/problems';
  import CopyDetails from './CopyDetails.svelte';
  // One person's contact details (AP-31, board 50): email and LinkedIn, kept once for the whole folder. Done saves
  // them (a new file in .studio/people/) when they changed. Used by the Credits window and by People.
  // Each box has Copy, and Write ↗ (a new email) or Open ↗ (the LinkedIn page) once it has something in it (#224, AP-55).
  import { linkedinUrl, savePerson, type Person } from '../lib/people';

  let { root, person, me, uses, onSaved }: {
    root: FileSystemDirectoryHandle; person: Person; me: string; uses: string; onSaved: (person: Person) => void;
  } = $props();

  // svelte-ignore state_referenced_locally (the form starts from the person as they were when it opened)
  let email = $state(person.email);
  // svelte-ignore state_referenced_locally
  let linkedin = $state(person.linkedin);
  let error = $state('');
  const id = $props.id();

  // Which box was just copied (or couldn't be): its Copy button says so for a moment.
  let copied = $state<{ box: 'email' | 'linkedin'; ok: boolean } | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function copy(box: 'email' | 'linkedin') {
    let ok = true;
    try {
      await navigator.clipboard.writeText((box === 'email' ? email : linkedin).trim());
    } catch {
      ok = false;
    }
    copied = { box, ok };
    clearTimeout(timer);
    timer = setTimeout(() => (copied = null), 1500);
  }

  // Saves what changed, then hands the person back. Returns false when it couldn't save.
  export async function done(): Promise<boolean> {
    error = '';
    if (email.trim() === person.email && linkedin.trim() === person.linkedin) return (onSaved(person), true);
    try {
      onSaved(await savePerson(root, { ...person, email, linkedin }, me));
      return true;
    } catch (e) {
      error = problem("Couldn't save the contact details. If the shared folder is still syncing, wait a moment and try again.", 'saving contact details', e);
      return false;
    }
  }
</script>

{#snippet field(box: 'email' | 'linkedin', name: string, go: string, goLabel: string, href: string)}
  <div class="field">
    <label for="{id}-{box}">{name}</label>
    <div class="line">
      {#if box === 'email'}
        <input id="{id}-{box}" type="email" bind:value={email} placeholder="name@example.org" />
      {:else}
        <input id="{id}-{box}" bind:value={linkedin} placeholder="linkedin.com/in/…" />
      {/if}
      {#if href}
        {@const state = copied?.box === box ? (copied.ok ? 'Copied' : "Couldn't copy") : 'Copy'}
        <button type="button" class="act" onclick={() => copy(box)} aria-label={state === 'Copy' ? `Copy ${name}` : `${name}: ${state}`}>{state}</button>
        <a class="act" {href} target="_blank" rel="noopener noreferrer" aria-label={goLabel}>{go} ↗</a>
      {/if}
    </div>
  </div>
{/snippet}

<div class="contact">
  <div class="fields">
    {@render field('email', 'Email', 'Write', 'Write an email', email.trim() && `mailto:${email.trim()}`)}
    {@render field('linkedin', 'LinkedIn', 'Open', 'Open the LinkedIn page', linkedinUrl(linkedin))}
  </div>
  {#if error}<p class="error" role="alert">{error}<CopyDetails message={error} /></p>{/if}
  <div class="foot">
    <span>Shared by every script: a change here shows in all {uses}.</span>
    <button class="primary small" onclick={done}>Done</button>
  </div>
</div>

<style>
  .contact { padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: #fafafa; }
  .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 10px; }
  .field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  label { font-size: 12px; color: var(--muted); }
  .line { display: flex; gap: 6px; }
  input { flex: 1; min-width: 0; min-height: 40px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 6px; font: inherit; font-size: 14px; color: var(--ink); }
  .act {
    display: inline-flex; align-items: center; flex: none; min-height: 40px; padding: 0 10px; border: 1px solid var(--line-strong);
    border-radius: 6px; background: #fff; font-size: 13px; color: var(--ink); text-decoration: none; white-space: nowrap;
  }
  .act:hover { background: #f0f0f0; }
  .foot { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 10px; }
  .foot span { flex: 1 1 200px; font-size: 12px; color: var(--muted); }
  .error { margin: 8px 0 0; font-size: 13px; color: var(--danger); }
</style>
