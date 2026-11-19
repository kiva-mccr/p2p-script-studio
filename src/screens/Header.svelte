<script lang="ts" module>
  // Something still open, listed before Approve (RV-5): a comment or suggestion (its id), or missing files (id '').
  export type Loose = { id: string; head: string; text: string };
</script>

<script lang="ts">
  import { exampleBar } from '../lib/examplebar.svelte';
  import CopyDetails from './CopyDetails.svelte';
  import HelpMenu from './HelpMenu.svelte';
  import { SAVE_FAILED } from '../lib/saving.svelte';
  import type { Seen } from '../lib/editing';
  import type { Format } from './Export.svelte';
  import type { Shared } from '../lib/share';
  import { shareLink } from '../lib/route';
  import Settings from './Settings.svelte';
  import Presence from './Presence.svelte';
  import type { StatusAge } from '../lib/statusage';
  import type { Snippet } from 'svelte';
  import { seriesOf } from '../lib/history';

  type Mode = 'write' | 'review' | 'history' | 'assets';
  let { folder, title, ready, mode, writeCount = 0, reviewCount = 0, loose, missingCount, voiceText, voiceWpm, play, editors, seen = [], folding = '', reviewStatus, stateAge = null, heldCount = 0, status, problem = '', onAllow, onLoose, onMode, onStatus, onFind, onPrompt, onCredits, onExport, onShare, onPlay, onStop, nextVersion, backMenu }: {
    folder: string; title: string; ready: boolean; mode: Mode; writeCount?: number; reviewCount?: number; loose: Loose[]; missingCount: number; voiceText: string; voiceWpm: number; editors: string[]; reviewStatus: string;
    stateAge?: StatusAge | null; // how long it has been in that status, and who put it there (#230)
    heldCount?: number; // comments on hold (RV-19): Send for review says they come back
    // Play the script (AU-2): null when there is nothing to play here; time is '' until it has started.
    play: { time: string; on: boolean } | null; onPlay: () => void; onStop: () => void;
    status: keyof typeof statusText;
    seen?: Seen[]; // who else has been here, newest first: "Sam was here 12 min ago" when nobody is editing (AP-37)
    folding?: string; // whose changes are being folded in now: a small spinner beside "… is editing" (FX-2)
    problem?: string; // why the last save failed, in the browser's words ("Writing script.md: NoModificationAllowedError: …")
    onAllow: () => void; onLoose: (id: string) => void; onMode: (to: Mode) => void;
    onStatus: (to: 'draft' | 'in review' | 'approved', note: string, message?: string) => void; onPrompt: () => void;
    onFind: () => void; // ⋯ › Find and replace, in Write (AP-32)
    onCredits: () => void; // ⋯ › Credits (AP-31)
    onExport: (to: Format) => void; onShare: () => Promise<Shared>;
    nextVersion: (series: 'r' | 'ap') => Promise<{ name: string; still: boolean }>; // what Send for review or Approve makes (RV-9, #240)
    backMenu: Snippet<[() => void]>; // Send back's menu (#248, SendBack.svelte), given a way to close it
  } = $props();

  const statusText = { saved: 'Saved', waiting: 'Editing…', saving: 'Saving…', failed: SAVE_FAILED, conflict: 'Not saved',
    locked: 'Not saved: the browser needs your OK to edit the folder' };
  // A failed save names the browser's error, so it can be reported (the field test on a shared folder): the name in
  // the bar, all of it on hover.
  const errorName = $derived(problem.split(': ')[1] ?? '');
  const shownStatus = $derived(status === 'failed' && errorName ? `Couldn't save (${errorName}), trying again` : statusText[status]);
  const bad = $derived(status === 'failed' || status === 'conflict' || status === 'locked');
  // What was just copied, said in the menu for a moment before it closes.
  let copied = $state<'' | 'link' | 'teams' | 'failed'>('');
  // Two menus, to keep the bar short (asked by the user): Export / Share (the link and the Teams message with their Copy buttons, #234, then Print,
  // Fountain, Final Draft and later exports, each opening the export screen, EX-9) and ⋯ (Find and replace in Write, Teleprompter, Credits, Settings).
  // 'approve': what is still open, before approving (RV-5, mock-up 20). It warns and never blocks.
  // 'send': a note for the reviewers, before sending (RV-8, mock-up 26). Optional; kept while the page is open.
  // 'back': the notes for the writer, before sending back (RV-13, #248); they see them at the top of Comments in Write.
  let menu = $state<'' | 'more' | 'export' | 'approve' | 'send' | 'back'>('');
  let sendNote = $state('');
  let sendMakes = $state<{ name: string; still: boolean } | null>(null); // shown in the send panel once known
  let approveMakes = $state(''); // "ap1": what Approve makes (#240), on its button's hover and in its panel
  let sendEl = $state<HTMLElement>();
  let backEl = $state<HTMLElement>();
  let settings = $state(false); // the Settings window (AU-3), opened from ⋯
  let moreEl = $state<HTMLElement>();
  let exportEl = $state<HTMLElement>();
  let approveEl = $state<HTMLElement>();

  // Approve at once when nothing is open; otherwise list what is (mock-up 20), and History says how much was left.
  function approve(anyway = false) {
    if (loose.length && !anyway) {
      if (menu !== 'approve') knowApprove();
      return void (menu = menu === 'approve' ? '' : 'approve');
    }
    menu = '';
    onStatus('approved', loose.length ? `Approved, ${loose.length} still open` : 'Approved');
  }
  function send() {
    menu = '';
    onStatus('in review', 'Sent for review', sendNote.trim());
    sendNote = '';
  }
  async function openSend() {
    if (menu === 'send') return void (menu = '');
    menu = 'send';
    sendMakes = null;
    sendMakes = await nextVersion('r').catch(() => null);
  }
  async function knowApprove() {
    approveMakes = (await nextVersion('ap').catch(() => null))?.name ?? '';
  }
  // Export / Share shows the link and a preview of the Teams message (#234): the message is made as the menu opens
  // (lib/share.ts, already escaped), and made again when copied, so the copy is never older than the click.
  const link = $derived(menu === 'export' ? shareLink(location.href) : '');
  let preview = $state<Shared | null>(null);
  function openShare() {
    if (menu === 'export') return void (menu = '');
    menu = 'export';
    preview = null;
    onShare().then((s) => (preview = s), () => {});
  }
  async function copyLink() {
    await copy('link', () => navigator.clipboard.writeText(link));
  }

  // Copy for Teams (EX-10): the message as formatted text, and as plain text for apps that don't take formatting.
  // The clipboard is given promises, so the click still counts while the Editor saves and reads History.
  async function copyTeams() {
    const shared = onShare();
    const as = (type: string) => shared.then((s) => new Blob([type === 'text/html' ? s.html : s.text], { type }));
    await copy('teams', () => navigator.clipboard.write([new ClipboardItem({ 'text/html': as('text/html'), 'text/plain': as('text/plain') })]));
  }

  async function copy(what: 'link' | 'teams', write: () => Promise<void>) {
    try {
      await write();
      copied = what;
    } catch {
      copied = 'failed';
    }
    setTimeout(() => ((copied = ''), (menu = '')), copied === 'failed' ? 2500 : 1200);
  }

  // The bar's height, for the column headings, Find, the side panel and scrolling to sit under it (UX-4). In the
  // example it sticks under the example's bar (issue #203), which counts too.
  let barHeight = $state(0);
  $effect(() => {
    document.documentElement.style.setProperty('--bar-h', `${barHeight + exampleBar.height}px`);
    return () => document.documentElement.style.removeProperty('--bar-h');
  });

  // A click outside the menu or Esc closes it.
  function away(event: Event) {
    const inside = (el?: HTMLElement) => el?.contains(event.target as Node);
    if (menu && !inside(moreEl) && !inside(exportEl) && !inside(approveEl) && !inside(sendEl) && !inside(backEl)) menu = '';
  }
</script>

<svelte:window onpointerdown={away} onkeydown={(e) => e.key === 'Escape' && (menu = '')} />

<header bind:offsetHeight={barHeight} style:top="{exampleBar.height}px">
  <nav class="crumbs" class:locked={ready && status === 'locked'} aria-label="Breadcrumb">
    <!-- A folder icon back to the list (mock-up 30, the user's pick): it leaves room for the length beside Saved. -->
    <a href="#/" class="back" aria-label="Back to {folder}" title="Back to {folder}">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
    </a>
    <span class="title" title={title}>{title}</span>
    <!-- Beside the title, where Word and Google Docs put it (AP-16, the user's pick): it is about the script, not an action. -->
    {#if ready}<span class="status" class:bad role="status" data-tour="saved" data-keep title={status === 'failed' ? problem : undefined}>{shownStatus}</span>{#if status === 'failed'}<CopyDetails message={SAVE_FAILED} />{/if}{/if}
    <!-- The length follows Saved as one grey line (mock-up 30, A), and steps aside for a red message. -->
    {#if ready && voiceText && !bad}<span class="voice" data-keep title={voiceText.includes('/') ? 'Voice-over recorded so far / the whole script (takes, plus read time for the rest)' : 'Read time of the whole script'}>{voiceText}</span>{/if}
    <!-- The browser took back its OK to edit the folder: only a click can ask again (mock-up 18, option A). -->
    {#if ready && status === 'locked'}<button class="allow" onclick={onAllow}>Allow editing</button>{/if}
  </nav>
  {#if ready}
    <nav class="modes" aria-label="Mode">
      <button aria-current={mode === 'write' ? 'page' : undefined} onclick={() => onMode('write')}>
        Write{#if writeCount}<span class="count" title="Comments and suggestions from the review, new to you" aria-label="{writeCount} new">{writeCount}</span>{/if}
      </button>
      <button aria-current={mode === 'review' ? 'page' : undefined} onclick={() => onMode('review')}>
        Review{#if reviewCount}<span class="count" title="Rows changed since it was sent back, new to you" aria-label="{reviewCount} new">{reviewCount}</span>{/if}
      </button>
      <button aria-current={mode === 'history' ? 'page' : undefined} onclick={() => onMode('history')}>History</button>
      <button aria-current={mode === 'assets' ? 'page' : undefined} onclick={() => onMode('assets')}>
        Assets{#if missingCount}<span class="count bad" aria-label="{missingCount} missing">{missingCount}</span>{/if}
      </button>
    </nav>
    <div class="right" data-tour="actions">
      <Presence {editors} {folding} {seen} />
      {#if reviewStatus === 'in review' && mode === 'review'}
        <span class="more" bind:this={backEl}>
          <button class="outline" aria-label="Send back to writer" aria-expanded={menu === 'back'} onclick={() => (menu = menu === 'back' ? '' : 'back')}>Send back</button>
          {#if menu === 'back'}
            <div class="menu approve-menu" role="region" aria-label="Send back to writer">
              {@render backMenu(() => (menu = ''))}
            </div>
          {/if}
        </span>
        <span class="more" bind:this={approveEl}>
          <button class="dark" aria-expanded={loose.length ? menu === 'approve' : undefined} onclick={() => approve()}
            onpointerenter={knowApprove} onfocus={knowApprove} title={approveMakes ? `It becomes ${approveMakes} in History.` : undefined}>Approve</button>
          {#if menu === 'approve'}
            <div class="menu approve-menu" role="region" aria-label="Still open">
              <p class="lead">{loose.length} {loose.length === 1 ? 'thing is' : 'things are'} still open</p>
              <div class="loose">
                {#each loose as item (item.id)}
                  <button onclick={() => ((menu = ''), onLoose(item.id))}><b>{item.head}</b><span>{item.text}</span></button>
                {/each}
              </div>
              <p class="quiet help">You can still approve. They stay open in Review.</p>
              {#if approveMakes}
                <p class="makes"><span class="version-tag ap">{approveMakes}</span>It becomes {approveMakes} in History.</p>
              {/if}
              <div class="actions">
                <button class="outline" onclick={() => (menu = '')}>Keep reviewing</button>
                <button class="dark" onclick={() => approve(true)}>Approve anyway</button>
              </div>
            </div>
          {/if}
        </span>
      {:else if reviewStatus !== 'in review' && mode === 'write'}
        <span class="more" bind:this={sendEl}>
          <button class="outline" aria-expanded={menu === 'send'} onclick={openSend}>Send for review</button>
          {#if menu === 'send'}
            <div class="menu approve-menu" role="region" aria-label="Send for review">
              <label class="lead" for="send-note">A note for the reviewers</label>
              <textarea id="send-note" rows="4" bind:value={sendNote} {@attach (el) => el.focus()} placeholder="What should they look at? (optional)"></textarea>
              {#if sendMakes}
                <p class="makes"><span class="version-tag {seriesOf(sendMakes.name)}">{sendMakes.name}</span>{sendMakes.still ? `Still ${sendMakes.name}: nothing has changed since it.` : `It becomes ${sendMakes.name} in History.`}</p>
              {/if}
              {#if heldCount}
                <p class="held">{heldCount === 1 ? 'The comment on hold comes' : `The ${heldCount} comments on hold come`} back into the open list for the reviewers.</p>
              {/if}
              <div class="actions">
                <button class="outline" onclick={() => (menu = '')}>Cancel</button>
                <button class="dark" onclick={send}>Send for review</button>
              </div>
            </div>
          {/if}
        </span>
      {/if}
      {#if reviewStatus === 'approved' || (reviewStatus === 'in review' && mode !== 'review')}<span class="state" data-keep title={stateAge?.title}><span>{reviewStatus === 'approved' ? 'Approved' : 'In review'}</span>{#if stateAge}<span class="age">{stateAge.age}</span>{/if}</span>{/if}
      {#if play}
        <button class="outline play" class:started={play.time} onclick={onPlay}
          aria-label={!play.time ? 'Play the script' : play.on ? 'Pause the script' : 'Carry on playing the script'}>
          {play.on ? '❚❚' : '▶'} {play.time || 'Play'}
        </button>
        {#if play.time}<button class="outline stop" aria-label="Stop playing" title="Stop" onclick={onStop}>■</button>{/if}
      {/if}
      <span class="more" bind:this={exportEl}>
        <button class="outline" aria-expanded={menu === 'export'} onclick={openShare}>Export / Share</button>
        {#if menu === 'export'}
          <div class="menu share-menu">
            <!-- The link itself and the Teams message as it will look (#234, board 87), each with its Copy. -->
            <div class="share">
              <span class="label">Link</span>
              <div class="link-row">
                <input readonly value={link} aria-label="Link to this script" onfocus={(e) => e.currentTarget.select()} />
                <button class="outline small" aria-label={copied === 'link' ? 'Link copied' : 'Copy link'} onclick={copyLink}>{copied === 'link' ? 'Copied' : 'Copy'}</button>
              </div>
              <span class="help">Opens this script on Review, for anyone who has the shared folder.</span>
            </div>
            <div class="share">
              <span class="label">Teams message</span>
              <!-- inert: its links are only a picture of the message, not to be followed or tabbed to here. -->
              <div class="teams" aria-label="How it looks in Teams" inert>
                {#if preview}{@html preview.html}{:else}<p class="waiting">…</p>{/if}
              </div>
              <button class="outline small teams-copy" onclick={copyTeams}>{copied === 'teams' ? 'Copied, paste it in Teams' : 'Copy for Teams'}</button>
            </div>
            {#if copied === 'failed'}<span class="failed" role="alert">Couldn't copy. Try again.</span>{/if}
            <span class="group rule">Export</span>
            <button onclick={() => ((menu = ''), onExport('print'))}>Print…</button>
            <button onclick={() => ((menu = ''), onExport('fountain'))}>Fountain (.fountain)</button>
            <button onclick={() => ((menu = ''), onExport('fdx'))}>Final Draft (.fdx)</button>
            <button onclick={() => ((menu = ''), onExport('voice'))}>Voice-over (.mp3, .wav)</button>
            <button onclick={() => ((menu = ''), onExport('edit'))}>Resolve / Premiere (.zip)</button>
            <button onclick={() => ((menu = ''), onExport('video'))}>Video (.mp4)</button>
          </div>
        {/if}
      </span>
      <span class="more" bind:this={moreEl}>
        <button class="outline dots" aria-label="More" title="More" aria-expanded={menu === 'more'} onclick={() => (menu = menu === 'more' ? '' : 'more')}>⋯</button>
        {#if menu === 'more'}
          <div class="menu">
            {#if mode === 'write'}<button onclick={() => ((menu = ''), onFind())}>Find and replace</button>{/if}
            <button onclick={() => ((menu = ''), onPrompt())}>Teleprompter</button>
            <button onclick={() => ((menu = ''), onCredits())}>Credits</button>
            <button onclick={() => ((menu = ''), (settings = true))}>Settings</button>
          </div>
        {/if}
      </span>
      <HelpMenu tone="dim" />
    </div>
  {/if}
</header>

{#if settings}<Settings {voiceWpm} onClose={() => (settings = false)} />{/if}

<style>
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 10px 20px; border-bottom: 1px solid var(--line); }
  /* The bar stays at the top of the window (UX-4, board 75); its height is --bar-h, for what sticks under it. */
  header { position: sticky; top: 0; z-index: 7; background: var(--ground); } /* over the timeline drawer (z 4) and its preview */
  /* html's scroll-padding-top counts the bar's own place as hidden, so focusing a button in it (Tab, a click)
     scrolled the page to "show" it. Each thing in the bar counts as drawn one bar lower: always in view. */
  header :global(*) { scroll-margin: calc(-1 * var(--bar-h, 0px)) 0 var(--bar-h, 0px); }
  .crumbs { display: flex; align-items: center; gap: 6px; flex: 1 1 260px; min-width: 0; } /* below that the bar wraps */
  /* The long "Not saved" and Allow editing don't fit beside the tabs: the bar wraps instead of hiding them. */
  .crumbs.locked { flex: 1 0 auto; max-width: 100%; }
  .back { display: inline-flex; flex: none; align-items: center; justify-content: center; width: 44px; height: 44px; margin-left: -10px;
    border-radius: 8px; color: var(--muted); }
  .back:hover { background: #f2f2f2; color: var(--accent); }
  .title { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* The title side and the buttons side grow alike, so the tabs sit in the middle of the window (#188, the user's
     pick); a side with more in it than its half pushes them over; it wraps whole onto a line of its own (fit-content) before its buttons wrap. */
  .right { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 4px; flex: 1 1 260px; min-width: fit-content; margin-left: auto; }
  .right > * { white-space: nowrap; }
  .right :global(.outline), .right .dark { padding: 0 12px; } /* narrower than elsewhere: the bar is one line at 1280 */
  .modes { display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: #f2f2f2; }
  .modes button { min-height: 40px; padding: 0 8px; border: 0; border-radius: 8px; background: none; color: var(--muted); font-size: 14px; font-weight: 500; }
  .modes button[aria-current] { background: var(--ground); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); color: var(--ink); }
  .count { display: inline-block; min-width: 20px; margin-left: 6px; padding: 1px 6px; box-sizing: border-box; border-radius: 10px;
    background: var(--accent); color: #fff; font-size: 12px; text-align: center; }
  .count.bad { background: var(--danger); }
  .dark { min-height: 44px; padding: 0 16px; border: 0; border-radius: 8px; background: var(--ink); color: #fff; font-size: 14px; font-weight: 500; }
  .dark:hover { background: #333; }
  .state { padding: 4px 10px; border-radius: 999px; background: #e7f4ec; color: #1b6b3e; font-size: 13px; font-weight: 500; white-space: nowrap; }
  /* How long (#230): "· 2 days", the "· " drawn here so the text is just the time. It goes first when the bar is narrow. */
  .age { font-weight: 400; }
  .age::before { content: ' · '; white-space: pre; }
  @media (max-width: 1180px) { .age { display: none; } }
  .status, .voice { flex: none; font-size: 13px; color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
  .status { margin-left: 6px; }
  .voice::before { content: '· '; } /* drawn, so the length's text stays just the time */
  .status.bad { color: var(--danger); }
  .allow { flex: none; min-height: 36px; margin-left: 4px; padding: 0 14px; border: 0; border-radius: 8px; background: var(--ink); color: #fff; font-size: 13px; font-weight: 500; white-space: nowrap; }
  .play { font-variant-numeric: tabular-nums; }
  .play.started { border-color: var(--accent); background: #eef2fb; color: var(--accent); }
  .stop { min-width: 44px; padding: 0; font-size: 12px; }
  .more { position: relative; }
  .dots { min-width: 44px; padding: 0 12px; font-size: 18px; line-height: 1; }
  .menu { position: absolute; z-index: 6; top: calc(100% + 6px); right: 0; display: flex; flex-direction: column; align-items: stretch;
    min-width: 220px; padding: 6px; border: 1px solid var(--line); border-radius: 10px; background: var(--ground);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10); font-size: 14px; }
  .menu > button:not(.dark) { min-height: 40px; padding: 0 12px; border: 0; border-radius: 6px; background: none; color: var(--ink);
    font-size: 14px; text-align: left; }
  .menu > button:not(.dark):hover { background: #f2f2f2; }
  .group { margin: 4px 12px 2px; font-size: 12px; color: var(--muted); }
  .group.rule { margin-top: 6px; padding-top: 8px; border-top: 1px solid var(--line); }
  .failed { padding: 4px 12px; font-size: 13px; color: var(--danger); }
  /* Share (#234): the link with Copy, and the Teams message as it will look, above the exports. */
  .share-menu { width: 360px; max-width: calc(100vw - 32px); white-space: normal; } /* the bar's nowrap ran long lines out of the box */
  .share { display: flex; flex-direction: column; gap: 6px; padding: 6px 12px; }
  .share .label { font-size: 12px; font-weight: 600; color: var(--muted); }
  .share .help { font-size: 12px; color: var(--muted); }
  .link-row { display: flex; gap: 6px; }
  .link-row input { flex: 1; min-width: 0; min-height: 32px; padding: 0 8px; border: 1px solid var(--line); border-radius: 6px;
    background: #fafafa; font: 12px ui-monospace, Menlo, monospace; color: #3d3d3d; }
  .small { min-height: 32px; padding: 0 10px; font-size: 13px; }
  .teams-copy { align-self: flex-start; }
  /* A small picture of the message in Teams: its lavender and its purple links. */
  .teams { padding: 10px; border: 1px solid #e1dff5; border-radius: 6px; background: #f5f5fc; font-size: 13px; line-height: 1.5;
    overflow-wrap: anywhere; }
  .teams :global(p) { margin: 0; }
  .teams :global(a) { color: #4f52b2; }
  .teams .waiting { color: var(--muted); }
  .approve-menu { width: 380px; gap: 12px; padding: 16px; white-space: normal; }
  .approve-menu p { margin: 0; }
  .lead { font-weight: 600; }
  .approve-menu textarea { box-sizing: border-box; width: 100%; min-height: 96px; padding: 10px 12px; border: 1px solid var(--line-strong);
    border-radius: 8px; font: inherit; font-size: 14px; line-height: 1.5; resize: vertical; }
  .quiet { font-size: 13px; color: var(--muted); }
  .makes { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 13px; }
  .held { margin: 0; padding: 8px 10px; border-radius: 8px; background: #fff4e5; font-size: 13px; line-height: 1.45; color: #3d3d3d; }
  .loose { display: flex; flex-direction: column; gap: 2px; max-height: 280px; overflow-y: auto; }
  .loose button { display: flex; flex-direction: column; justify-content: center; min-height: 44px; padding: 4px 8px; border: 0; border-radius: 6px;
    background: none; color: var(--ink); font-size: 13px; text-align: left; }
  .loose button:hover { background: #f2f2f2; }
  .loose b { font-weight: 600; }
  .loose span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
