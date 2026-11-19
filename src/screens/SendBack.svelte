<script lang="ts">
  import { onMount } from 'svelte';
  import { newId, readBackNotes, waiting, writeBackNote, type BackNote, type SentNote } from '../lib/backnotes';
  import { problem } from '../lib/problems';
  import { ago } from '../lib/when';
  import TextField from './TextField.svelte';
  import NoteText from './NoteText.svelte';

  // Review's Send back menu (#248, board 84): the notes other reviewers added this round, your own note with the
  // planning panel's formatting, "Add my note" to leave it without sending, and the send back, which takes them all.
  let { dir, me, since, text = $bindable(''), onSend }: {
    dir: FileSystemDirectoryHandle; me: string; since: string; // since: the newest "Sent for review" ('' for any time)
    text?: string; // your note, kept by the Editor while the page is open, so closing the menu doesn't lose it
    onSend: (message: string, notes: SentNote[]) => void; // closing is the menu's: Escape or a click outside
  } = $props();

  let others = $state<BackNote[]>([]);
  let mine = $state<BackNote | null>(null); // your note as added, until it is sent
  let added = $state(false); // the box holds what was added, unchanged
  let busy = $state(false);
  let error = $state('');
  let box = $state<HTMLElement>();

  onMount(() => {
    box?.querySelector('textarea')?.focus();
    readBackNotes(dir)
      .then((notes) => {
        const round = waiting(notes, since);
        others = round.filter((n) => n.by !== me);
        mine = round.findLast((n) => n.by === me) ?? null;
        if (mine && !text.trim()) text = mine.text;
        added = !!mine && text.trim() === mine.text;
      })
      .catch(() => {}); // the folder may be busy: the others' notes still go when it's read at the send
  });

  async function keep(removed = false) {
    busy = true;
    error = '';
    try {
      const id = mine?.id ?? newId();
      const note = await writeBackNote(dir, { id, by: me, who: me, made: mine?.made ?? new Date().toISOString(), text: removed ? '' : text.trim(), ...(removed ? { removed: true as const } : {}) });
      mine = removed ? null : note;
      if (removed) text = '';
      added = !removed;
    } catch (e) {
      error = problem("The note couldn't be saved. If the shared folder is busy, wait a moment and try again.", 'adding a note for the writer', e);
    }
    busy = false;
  }

  // Sends every note added this round, read again now so one added a moment ago goes too. Yours is the message.
  async function send() {
    busy = true;
    const round = await readBackNotes(dir).then((notes) => waiting(notes, since)).catch(() => others);
    busy = false;
    onSend(text.trim(), round.filter((n) => n.by !== me && n.text.trim()).map(({ id, by, made, text }) => ({ id, by, made, text })));
  }
</script>

<p class="lead">Notes for the writer</p>
{#each others as n (n.id)}
  <div class="note" role="note" aria-label="{n.by}'s note">
    <p class="by"><b>{n.by}</b> · {ago(Date.parse(n.made))}</p>
    <NoteText text={n.text} />
  </div>
{/each}
<div class="box" bind:this={box}>
  <TextField bind:value={text} oninput={() => (added = false)} lists label="Your note for the writer" placeholder="What should they fix first? (optional)" />
</div>
<p class="quiet help">Add my note leaves it here for the other reviewers; whoever sends it back sends them all. The writer sees them at the top of Comments in Write. Kept in History.</p>
{#if error}<p class="error" role="alert">{error}</p>{/if}
<div class="actions">
  {#if mine}<button class="link" aria-label="Delete my note" disabled={busy} onclick={() => keep(true)}>Delete</button>{/if}
  <button class="outline" disabled={busy || !text.trim() || added} onclick={() => keep()}>{added ? 'Note added ✓' : mine ? 'Save my note' : 'Add my note'}</button>
  <button class="dark" disabled={busy} onclick={send}>Send back to writer</button>
</div>

<style>
  p { margin: 0; }
  .lead { font-weight: 600; }
  .note { padding: 8px 10px; border-radius: 8px; background: #fff4e5; font-size: 13px; color: #3d3d3d; }
  .note .by { line-height: 1.5; }
  .note b { color: var(--ink); font-weight: 600; }
  .box { padding: 8px 12px; border: 1px solid var(--line-strong); border-radius: 8px; font-size: 14px; line-height: 1.5; }
  .box:focus-within { border-color: var(--accent); }
  .box :global(textarea) { min-height: 72px; }
  .quiet { font-size: 13px; color: var(--muted); }
  .error { font-size: 13px; color: var(--danger); }
  .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 8px; }
  .link { margin-right: auto; min-height: 36px; padding: 0 4px; border: 0; background: none; color: var(--muted); font-size: 13px; }
  .link:hover { color: var(--ink); text-decoration: underline; }
  .dark { min-height: 44px; padding: 0 14px; border: 0; border-radius: 8px; background: var(--ink); color: #fff; font-size: 14px; font-weight: 500; }
  .dark:hover { background: #333; }
  button:disabled { opacity: 0.6; cursor: default; }
</style>
