<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { feedback } from '../lib/help.svelte';
  import { describe, onScrollbar, partOf, placePanel, ringBox, issueBody, issueTitle, issueUrl, plainText, type Env, type Part } from '../lib/feedback';
  import { makePictures } from '../lib/feedbackshot';
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
  // Both pictures (covered and not) are taken once per pick, from the same moment: the ticks only choose (issue #244).
  type Shot = { blob: Blob; url: string } | 'making' | 'failed' | null;
  let shots = $state<{ covered: Shot; plain: Shot }>({ covered: null, plain: null });
  const shot = $derived(withPicture ? shots[cover ? 'covered' : 'plain'] : null);
  const picture = $derived(shot && typeof shot === 'object' ? shot : null);
  const making = $derived(shot === 'making');
  const pictureFailed = $derived(shot === 'failed');
  let done = $state<'' | 'sent' | 'sent-alone' | 'copied' | 'failed'>('');
  let box = $state<HTMLTextAreaElement>();
  let made = 0; // which pick the pictures are for, so a slow one never replaces a newer one

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

  // The note belongs to one piece of feedback: once it's sent or copied, or the panel is closed, the next starts
  // empty. Pick again before sending keeps it (the person is only changing the part).
  function again() {
    if (done) note = '';
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
    note = '';
    clearPictures();
  }

  function clearPictures() {
    made++;
    for (const s of [shots.covered, shots.plain]) if (s && typeof s === 'object') URL.revokeObjectURL(s.url);
    shots = { covered: null, plain: null };
  }

  // While picking, the page's own clicks and keys are held back: the click only says which part. Holding Shift lets
  // them through (AP-49), to open a menu or a dropdown; letting go picks again, and the menu stays open.
  let through = $state(false);
  $effect(() => {
    if (mode !== 'picking') return;
    let passing = false; // a press made with Shift held: its release and click go through too, even if Shift is let go
    const shift = (e: KeyboardEvent | PointerEvent | MouseEvent) => {
      through = e.shiftKey;
      if (through) hover = null;
    };
    const move = (e: PointerEvent) => {
      shift(e);
      hover = !through && e.target instanceof Element && !ours(e.target) ? partOf(e.target).getBoundingClientRect() : null;
    };
    const hold = (e: Event) => {
      if (ours(e.target)) return;
      if (e.type === 'pointerdown' || e.type === 'mousedown') passing = (e as MouseEvent).shiftKey;
      if (passing || (e as MouseEvent).shiftKey) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const m = e as MouseEvent;
      if (e.type === 'pointerdown' && m.target instanceof Element && onScrollbar(m.target, m.clientX, m.clientY)) {
        keepScroll(m.target);
        pick(m.target);
      }
    };
    const click = (e: MouseEvent) => {
      if (ours(e.target)) return;
      if (passing || e.shiftKey) return void (passing = false);
      hold(e);
      if (e.target instanceof Element) pick(partOf(e.target));
    };
    const key = (e: KeyboardEvent) => {
      shift(e);
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      stop();
    };
    const lost = () => (through = false);
    const held = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'dblclick', 'auxclick', 'contextmenu'];
    addEventListener('pointermove', move, true);
    held.forEach((t) => addEventListener(t, hold, true));
    addEventListener('click', click, true);
    addEventListener('keydown', key, true);
    addEventListener('keyup', shift, true);
    addEventListener('blur', lost);
    document.documentElement.classList.add('feedback-picking');
    return () => {
      removeEventListener('pointermove', move, true);
      held.forEach((t) => removeEventListener(t, hold, true));
      removeEventListener('click', click, true);
      removeEventListener('keydown', key, true);
      removeEventListener('keyup', shift, true);
      removeEventListener('blur', lost);
      document.documentElement.classList.remove('feedback-picking');
      through = false;
    };
  });
  $effect(() => {
    document.documentElement.classList.toggle('feedback-through', through);
  });

  // A press on a scroll bar (the timeline's, issue #252) drags it whatever preventDefault says, and no click follows:
  // it picks at once, and the bar is put back where it was until the button is let go. Scroll events come a frame
  // late, so the last of a drag can land after the release: it is put back once more and watched a little longer,
  // until the next press (which may be a drag with Shift).
  function keepScroll(el: Element) {
    const left = el.scrollLeft, top = el.scrollTop;
    const back = () => el.scrollTo(left, top);
    const end = () => {
      el.removeEventListener('scroll', back);
      removeEventListener('pointerdown', end, true);
    };
    const release = () => {
      removeEventListener('pointerup', release, true);
      removeEventListener('blur', release);
      back();
      addEventListener('pointerdown', end, true);
      setTimeout(end, 300);
    };
    el.addEventListener('scroll', back);
    addEventListener('pointerup', release, true);
    addEventListener('blur', release);
  }

  // The tour's Feedback step (issue #202) shows the mode in use: the strip, and the orange outline on a row on screen,
  // as if the pointer were over it. Nothing is caught, so the tour's buttons keep working.
  let demo = $state<DOMRect | null>(null);
  const showing = $derived(feedback.tour === 'feedback' && mode === 'off');
  $effect(() => {
    if (!showing) return;
    const place = () => (demo = rowOnScreen()?.getBoundingClientRect() ?? null);
    place();
    addEventListener('scroll', place, true);
    addEventListener('resize', place);
    return () => {
      removeEventListener('scroll', place, true);
      removeEventListener('resize', place);
      demo = null;
    };
  });

  // The first row wholly between the top bar and the timeline's drawer (html's scroll padding), else any row in sight.
  function rowOnScreen(): Element | undefined {
    const pad = getComputedStyle(document.documentElement);
    const top = parseFloat(pad.scrollPaddingTop) || 0, bottom = innerHeight - (parseFloat(pad.scrollPaddingBottom) || 0);
    const rows = [...document.querySelectorAll('[data-tour="row"]')];
    const at = (el: Element) => el.getBoundingClientRect();
    return rows.find((el) => at(el).top >= top && at(el).bottom <= bottom) ?? rows.find((el) => at(el).bottom > top && at(el).top < bottom);
  }

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
    if (done) note = '';
    done = '';
    mode = 'open';
    clearPictures();
    drawPictures();
    await tick();
    box?.focus();
  }

  // Taken when the part is picked, or when Add a picture is first ticked after that; never again for the same pick.
  function drawPictures() {
    if (!withPicture || !picked || shots.covered || shots.plain) return;
    const n = made;
    const taking = makePictures(picked);
    for (const kind of ['covered', 'plain'] as const) {
      shots[kind] = 'making';
      taking[kind].then(
        (blob) => { if (n === made) shots[kind] = { blob, url: URL.createObjectURL(blob) }; },
        () => { if (n === made) shots[kind] = 'failed'; },
      );
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

<!-- tour: the tour's Feedback step's outline (issue #328): under the tour's card, lit by the tour's hole. -->
{#snippet ring(r: DOMRect, tour = false)}
  {@const b = ringBox(r, { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight })}
  <div class="ring" class:tour data-feedback-ring data-tour={tour ? 'feedback' : undefined} aria-hidden="true" style:left="{b.left}px" style:top="{b.top}px" style:width="{b.width}px" style:height="{b.height}px"></div>
{/snippet}

{#snippet strip()}
  <p><b>Feedback:</b> click the part that's giving you trouble or could be better.
    <span class="help">Hold Shift to use the page, for example to open a menu.</span> Esc to stop.</p>
  <button type="button" class="outline" onclick={stop}>Stop</button>
{/snippet}

{#if mode === 'picking'}
  <div class="strip" role="status" data-feedback-ui>{@render strip()}</div>
  {#if hover}{@render ring(hover)}{/if}
{:else if showing}
  <!-- Shown by the tour (issue #202): inert, the tour's own card does the talking. -->
  <div class="strip" data-tour-clear inert>{@render strip()}</div>
  {#if demo}{@render ring(demo, true)}{/if}
{/if}

{#if mode === 'open' && part}
  {#if rect}{@render ring(rect)}{/if}
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
        <label><input type="checkbox" bind:checked={withPicture} onchange={drawPictures} /> Add a picture of this part</label>
        <label><input type="checkbox" bind:checked={cover} disabled={!withPicture} /> Cover the script's words and names</label>
        <label><input type="checkbox" bind:checked={withName} /> Say which script</label>
      </div>
    </div>
    <div class="actions">
      {#if __SEALED__}
        <!-- The sealed app opens no website (SE-10): the note is copied, to pass on by hand. -->
        <button type="button" class="primary" onclick={copy}>Copy</button>
      {:else}
        <button type="button" class="primary" onclick={send} disabled={making}>Open on GitHub</button>
        <button type="button" class="outline" onclick={copy}>Copy instead</button>
      {/if}
      <button type="button" class="link" onclick={stop}>{done ? 'Close' : 'Cancel'}</button>
    </div>
    {#if done === 'sent'}<p class="done" role="status">GitHub opened in a new tab with your note filled in. The picture is copied: click in the issue's box and press Ctrl+V, then Submit new issue.</p>
    {:else if done === 'sent-alone'}<p class="done" role="status">GitHub opened in a new tab with your note filled in. Press Submit new issue there.</p>
    {:else if done === 'copied'}<p class="done" role="status">Copied. Paste it into Teams or an email to whoever looks after the app.</p>
    {:else if done === 'failed'}<p class="done bad" role="status">Couldn't copy.{__SEALED__ ? '' : ' Try Open on GitHub instead.'}</p>{/if}
    {#if !__SEALED__}<p class="help">GitHub is public. Nothing from the script goes in unless you tick it, and you see it all on GitHub before you submit.</p>{/if}
  </section>
{/if}

<style>
  :global(html.feedback-picking:not(.feedback-through)), :global(html.feedback-picking:not(.feedback-through) *) { cursor: crosshair !important; }
  .strip { position: fixed; z-index: 60; left: 50%; bottom: 40px; transform: translateX(-50%); width: min(720px, calc(100% - 32px));
    box-sizing: border-box; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; padding: 6px 16px;
    border: 1px solid #c9d5f2; border-radius: 10px; background: #eef2fb; font-size: 14px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); }
  .strip p { flex: 1 1 320px; margin: 0; color: #3d3d3d; }
  .strip b { color: var(--ink); font-weight: 600; }
  .strip .outline { min-height: 36px; border-color: #c9d5f2; }
  .ring { position: fixed; z-index: 59; box-sizing: border-box; border: 2px solid #e8590c; border-radius: 4px; pointer-events: none; }
  .ring.tour { z-index: 29; }
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
