<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { feedback } from '../lib/help.svelte';
  import { describe, partOf, placePanel, issueBody, issueTitle, issueUrl, plainText, type Env, type Part } from '../lib/feedback';
  import { makePicture } from '../lib/feedbackshot';
  import { parseRoute } from '../lib/route';

  // Feedback mode (AP-48, board 71): Feedback… in the ? menu of the top bar (SB-5), click the part that's the trouble, write a
  // note, and open GitHub's new issue page filled in (the picture is copied to paste in). Nothing is sent by the app.

  let mode = $state<'off' | 'picking' | 'open'>('off');
  let hover = $state<DOMRect | null>(null);
  let picked: Element | null = null;
  let rect = $state<DOMRect | null>(null);
  let part = $state<Part | null>(null);
  let note = $state('');
  let withPicture = $state(true);
  let cover = $state(true);
  let withName = $state(false);
  let picture = $state<{ blob: Blob; url: string } | null>(null);
  let making = $state(false);
  let pictureFailed = $state(false);
  let done = $state<'' | 'sent' | 'sent-alone' | 'copied' | 'failed'>('');
  let box = $state<HTMLTextAreaElement>();
  let made = 0; // which picture is the latest, so a slow one never replaces a newer one

  // Started from the ? menu in the top bar (SB-5): it raises feedback.asked.
  let seenAsk = feedback.asked;
  $effect(() => {
    if (feedback.asked === seenAsk) return;
    seenAsk = feedback.asked;
    untrack(() => (mode === 'off' ? start() : again()));
  });

  const ours = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-feedback-ui]');

  function start() {
    if (mode !== 'off') return stop();
    mode = 'picking';
    hover = null;
  }

  function again() {
    mode = 'picking';
    rect = null;
    done = '';
  }

  function stop() {
    mode = 'off';
    hover = null;
    picked = null;
    rect = null;
    done = '';
    setPicture(null);
  }

  function setPicture(next: { blob: Blob; url: string } | null) {
    if (picture) URL.revokeObjectURL(picture.url);
    picture = next;
  }

  // While picking, the page's own clicks and keys are held back: the click only says which part.
  $effect(() => {
    if (mode !== 'picking') return;
    const move = (e: PointerEvent) => {
      hover = e.target instanceof Element && !ours(e.target) ? partOf(e.target).getBoundingClientRect() : null;
    };
    const hold = (e: Event) => {
      if (ours(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    const click = (e: MouseEvent) => {
      if (ours(e.target)) return;
      hold(e);
      if (e.target instanceof Element) pick(partOf(e.target));
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      stop();
    };
    const held = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick', 'auxclick', 'contextmenu'];
    addEventListener('pointermove', move, true);
    held.forEach((t) => addEventListener(t, hold, true));
    addEventListener('click', click, true);
    addEventListener('keydown', key, true);
    document.documentElement.classList.add('feedback-picking');
    return () => {
      removeEventListener('pointermove', move, true);
      held.forEach((t) => removeEventListener(t, hold, true));
      removeEventListener('click', click, true);
      removeEventListener('keydown', key, true);
      document.documentElement.classList.remove('feedback-picking');
    };
  });

  // The picked part keeps its outline as the page scrolls or the window changes size.
  $effect(() => {
    if (mode !== 'open') return;
    const place = () => (rect = picked?.isConnected ? picked.getBoundingClientRect() : null);
    addEventListener('scroll', place, true);
    addEventListener('resize', place);
    return () => {
      removeEventListener('scroll', place, true);
      removeEventListener('resize', place);
    };
  });

  async function pick(el: Element) {
    picked = el;
    rect = el.getBoundingClientRect();
    part = describe(el, location.hash);
    hover = null;
    done = '';
    mode = 'open';
    drawPicture();
    await tick();
    box?.focus();
  }

  async function drawPicture() {
    const n = ++made;
    setPicture(null);
    pictureFailed = false;
    if (!withPicture || !picked) return;
    making = true;
    try {
      const blob = await makePicture(picked, cover);
      if (n === made) setPicture({ blob, url: URL.createObjectURL(blob) });
    } catch {
      if (n === made) pictureFailed = true;
    } finally {
      if (n === made) making = false;
    }
  }

  function env(): Env {
    const named = withName ? { script: parseRoute(location.hash).join('/') || undefined, page: location.hash || '#/' } : {};
    return { version: __VERSION__, ua: navigator.userAgent, width: innerWidth, height: innerHeight, ...named };
  }

  async function send() {
    if (!part) return;
    let pasted = false;
    if (withPicture && picture) {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': picture.blob })]);
        pasted = true;
      } catch {
        // Clipboard blocked: the issue goes without the picture.
      }
    }
    window.open(issueUrl(issueTitle(part), issueBody(note, part, env(), pasted)), '_blank', 'noopener');
    done = pasted ? 'sent' : 'sent-alone';
  }

  async function copy() {
    if (!part) return;
    try {
      await navigator.clipboard.writeText(plainText(issueTitle(part), issueBody(note, part, env(), false)));
      done = 'copied';
    } catch {
      done = 'failed';
    }
  }

  // Beside the part, always whole on screen (placePanel): it is measured once drawn, and placed again as it grows.
  let panelW = $state(440);
  let panelH = $state(360);
  const panelStyle = $derived.by(() => {
    const at = placePanel(rect, { width: panelW, height: panelH }, { width: innerWidth, height: innerHeight });
    return `left: ${at.left}px; top: ${at.top}px;`;
  });
</script>

{#if mode === 'picking'}
  <div class="strip" role="status" data-feedback-ui>
    <p><b>Feedback:</b> click the part that's giving you trouble or could be better. Esc to stop.</p>
    <button type="button" class="outline" onclick={stop}>Stop</button>
  </div>
  {#if hover}<div class="ring" aria-hidden="true" style:left="{hover.left - 3}px" style:top="{hover.top - 3}px" style:width="{hover.width + 6}px" style:height="{hover.height + 6}px"></div>{/if}
{/if}

{#if mode === 'open' && part}
  {#if rect}<div class="ring" aria-hidden="true" style:left="{rect.left - 3}px" style:top="{rect.top - 3}px" style:width="{rect.width + 6}px" style:height="{rect.height + 6}px"></div>{/if}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <section class="panel" aria-label="Feedback" data-feedback-ui style={panelStyle} bind:offsetWidth={panelW} bind:offsetHeight={panelH}
    onkeydown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); stop(); } }}>
    <div class="top">
      <h2>Feedback on: {part.label}{part.row ? `, row ${part.row}` : ''}</h2>
      <button type="button" class="again" onclick={again}>Pick again</button>
    </div>
    <label class="note">What's wrong, or what could be better?
      <textarea rows="3" bind:value={note} bind:this={box}></textarea>
    </label>
    <div class="extras">
      {#if withPicture}
        <div class="picture">
          {#if picture}<img src={picture.url} alt="The part, outlined" />
          {:else if making}<span>Making the picture…</span>
          {:else if pictureFailed}<span>The picture couldn't be made.</span>{/if}
        </div>
      {/if}
      <div class="ticks">
        <label><input type="checkbox" bind:checked={withPicture} onchange={drawPicture} /> Add a picture of this part</label>
        <label><input type="checkbox" bind:checked={cover} disabled={!withPicture} onchange={drawPicture} /> Cover the script's words and names</label>
        <label><input type="checkbox" bind:checked={withName} /> Say which script</label>
      </div>
    </div>
    <div class="actions">
      <button type="button" class="primary" onclick={send} disabled={making}>Open on GitHub</button>
      <button type="button" class="outline" onclick={copy}>Copy instead</button>
      <button type="button" class="link" onclick={stop}>{done ? 'Close' : 'Cancel'}</button>
    </div>
    {#if done === 'sent'}<p class="done" role="status">GitHub opened in a new tab with your note filled in. The picture is copied: click in the issue's box and press Ctrl+V, then Submit new issue.</p>
    {:else if done === 'sent-alone'}<p class="done" role="status">GitHub opened in a new tab with your note filled in. Press Submit new issue there.</p>
    {:else if done === 'copied'}<p class="done" role="status">Copied. Paste it into Teams or an email to whoever looks after the app.</p>
    {:else if done === 'failed'}<p class="done bad" role="status">Couldn't copy. Try Open on GitHub instead.</p>{/if}
    <p class="help">GitHub is public. Nothing from the script goes in unless you tick it, and you see it all on GitHub before you submit.</p>
  </section>
{/if}

<style>
  :global(html.feedback-picking), :global(html.feedback-picking *) { cursor: crosshair !important; }
  .strip { position: fixed; z-index: 60; left: 50%; bottom: 40px; transform: translateX(-50%); width: min(720px, calc(100% - 32px));
    box-sizing: border-box; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; padding: 6px 16px;
    border: 1px solid #c9d5f2; border-radius: 10px; background: #eef2fb; font-size: 14px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); }
  .strip p { flex: 1 1 320px; margin: 0; color: #3d3d3d; }
  .strip b { color: var(--ink); font-weight: 600; }
  .strip .outline { min-height: 36px; border-color: #c9d5f2; }
  .ring { position: fixed; z-index: 59; box-sizing: border-box; border: 2px solid #e8590c; border-radius: 4px; pointer-events: none; }
  .panel { position: fixed; z-index: 61; width: min(440px, calc(100% - 32px)); max-height: calc(100vh - 16px); overflow: auto;
    box-sizing: border-box; display: flex; flex-direction: column; gap: 12px; padding: 16px; border: 1px solid var(--line);
    border-radius: 12px; background: var(--ground); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.1); font-size: 14px; text-align: left; }
  .top { display: flex; align-items: baseline; gap: 8px; }
  h2 { flex: 1; margin: 0; font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
  .again { min-height: 32px; padding: 0 6px; border: 0; background: none; color: var(--accent); font-size: 13px; white-space: nowrap; }
  .note { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: var(--muted); }
  textarea { box-sizing: border-box; width: 100%; padding: 8px 10px; border: 1px solid #cfcfcf; border-radius: 8px;
    font: 14px/1.5 inherit; font-family: inherit; color: var(--ink); resize: vertical; }
  .extras { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
  .picture { flex: none; width: 160px; min-height: 60px; display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--line); border-radius: 6px; background: #fafafa; font-size: 12px; color: var(--muted); text-align: center; }
  .picture img { display: block; max-width: 100%; max-height: 120px; }
  .ticks { display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: #3d3d3d; }
  .ticks label { display: flex; align-items: center; gap: 8px; min-height: 32px; }
  .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .actions .primary { min-height: 40px; padding: 0 16px; font-size: 14px; }
  .actions .outline { min-height: 40px; }
  .actions .link { min-height: 40px; }
  .done { margin: 0; font-size: 13px; line-height: 1.5; color: #3d3d3d; }
  .done.bad { color: var(--danger); }
  .help { margin: 0; font-size: 12px; line-height: 1.5; color: #6b6b6b; }
</style>
