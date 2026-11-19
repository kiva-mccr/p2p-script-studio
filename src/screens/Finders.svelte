<script lang="ts">
  // Who finds or films a missing shot (#211, board 88): the people on one "to find" note in Assets, each with × to
  // take them off, and + Who to add someone from the folder's people (Credits) or by a name typed in.
  import type { Person } from '../lib/people';

  let { who, what, people, onSet }: {
    who: string[]; what: string; people: () => Promise<Person[]>; onSet: (names: string[]) => void;
  } = $props();

  let open = $state(false);
  let query = $state('');
  let everyone = $state<Person[]>([]);
  let failed = $state(false);

  const on = (name: string) => who.some((w) => w.toLowerCase() === name.trim().toLowerCase());
  const pickable = $derived(everyone.filter((p) => !on(p.name) && p.name.toLowerCase().includes(query.trim().toLowerCase())));
  // A name typed in: commas and brackets would end the note's list, so they go.
  const typed = $derived(query.replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim());
  const known = $derived(everyone.some((p) => p.name.toLowerCase() === typed.toLowerCase()));

  async function start() {
    open = true;
    query = '';
    try {
      everyone = await people();
    } catch {
      failed = true;
    }
  }

  function add(name: string) {
    if (name && !on(name)) onSet([...who, name]);
    open = false;
  }

  function addTyped(event: SubmitEvent) {
    event.preventDefault();
    const match = everyone.find((p) => p.name.toLowerCase() === typed.toLowerCase());
    add(match?.name ?? typed);
  }
</script>

<span class="finders">
  {#each who as name (name)}
    <span class="person">{name}<button aria-label={`Take ${name} off ${what}`} onclick={() => onSet(who.filter((w) => w !== name))}>×</button></span>
  {/each}
  {#if !open}<button class="add" onclick={start}>+ Who</button>{/if}
</span>
{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="picker" onkeydown={(e) => e.key === 'Escape' && (e.stopPropagation(), (open = false))}>
    <form onsubmit={addTyped}>
      <!-- svelte-ignore a11y_autofocus -->
      <label>Who finds or films it <input bind:value={query} placeholder="Find or type a name" maxlength="80" autofocus /></label>
      {#if typed && !known}<button class="primary" type="submit">Add "{typed}"</button>{/if}
      <button class="outline" type="button" onclick={() => (open = false)}>Cancel</button>
    </form>
    <ul aria-label="People in the folder">
      {#each pickable as person (person.id)}
        <li><button onclick={() => add(person.name)}><b>{person.name}</b><span class="role">{person.role}</span></button></li>
      {:else}
        <li class="none">{failed ? "The folder's people couldn't be read. Type a name instead." : query.trim() ? `Nobody in the folder matches "${query.trim()}".` : everyone.length ? 'Everyone in the folder is on it.' : 'Nobody in the folder yet. Type a name, or add people in Credits.'}</li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .finders { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; }
  .person { display: inline-flex; align-items: center; gap: 2px; padding: 2px 2px 2px 8px; border-radius: 999px; background: #eef2fc;
    color: #22479f; font-size: 12px; }
  .person button { width: 20px; height: 20px; padding: 0; border: 0; border-radius: 50%; background: none; color: inherit; font-size: 14px; line-height: 1; }
  .person button:hover { background: #dbe4f8; }
  .add { min-height: 26px; padding: 0 8px; border: 1px dashed #c9c9c9; border-radius: 999px; background: var(--ground); color: var(--muted); font-size: 12px; }
  .add:hover { border-color: var(--accent); color: var(--accent); }
  .picker { order: 1; flex: 1 0 100%; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  form { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; padding: 10px 12px; border-bottom: 1px solid #f0f0f0; background: #fafafa; }
  form button { min-height: 36px; padding: 0 12px; font-size: 13px; }
  label { flex: 1 1 260px; display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
  input { flex: 1; min-width: 0; min-height: 36px; padding: 0 10px; border: 1px solid var(--line-strong); border-radius: 6px; font: inherit; color: var(--ink); }
  ul { max-height: 220px; overflow-y: auto; margin: 0; padding: 0; list-style: none; }
  li button { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 44px; padding: 8px 12px; border: 0; border-bottom: 1px solid #f0f0f0;
    background: var(--ground); color: var(--ink); font-size: 14px; text-align: left; }
  li button:hover { background: #f7f7f7; }
  li b { flex: 0 0 160px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .role { flex: 1; min-width: 0; font-size: 13px; color: var(--muted); }
  .none { padding: 12px; font-size: 13px; color: var(--muted); }
</style>
