<script lang="ts">
  import { slide } from 'svelte/transition';
  import { problem } from '../lib/problems';
  import { addAsset, assetFile } from '../lib/folder';
  import { plain } from '../lib/format';
  import { clock, speaking } from '../lib/readtime.svelte';
  import { keep, recall } from '../lib/remember';
  import { markTimelineOnly, rows, type Row, type Script } from '../lib/script';
  import { changeChoices, cutPositions, cutWords, dialogueWords, fitZoom, heardWords, isVideo, layout, pictureFiles, readChoices, shapeOf, ZOOM_MAX, type After, type Shape, type TimeBlock } from '../lib/timeline';
  import type { Player } from '../lib/play.svelte';
  import { rowLength, type VoiceOver } from '../lib/voice.svelte';
  import { waveform, wavePath } from '../lib/waveform';
  import AfterEditor from './AfterEditor.svelte';
  import PreviewShot from './PreviewShot.svelte';
  import { near } from '../lib/near';
  import { makePreview, revokePreview, type Preview } from '../lib/preview';

  // The storyboard timeline (SB-1, board 63), in a drawer at the bottom of the screen (SB-4, board 76): sections, rows with their pictures, and
  // the voice-over, laid out in time. Mostly a view of the script; the only choices are the pictures and the holds
  // and placeholders, kept in each row's Timeline line. selected: the block picked (a row id, or "hold:<id>" /
  // "placeholder:<id>"), shared with the bars in the script. onTimeline sets a row's Timeline line; onFiles its
  // Files; onRemoveAfter removes the hold or placeholder after a row (with Undo); onShow scrolls to a row.
  // readOnly (Review): no choices; a click on a block comments on its row (onComment), a hold or placeholder on the
  // row before it. onShape sets the video's shape (SB-3), wide or upright, for the preview, its collages and the export.
  let { script, dir, voice, player, canPlay, selected = $bindable(), readOnly = false, onTimeline = () => {}, onFiles = () => {},
    onRemoveAfter = () => {}, onShow = () => {}, onComment = () => {}, onShape = () => {}, onPlayFrom, onNotice }: {
    script: Script; dir: FileSystemDirectoryHandle; voice: VoiceOver; player: Player; canPlay: boolean; selected: string; readOnly?: boolean;
    onTimeline?: (id: string, line: string) => void; onFiles?: (id: string, files: string[]) => void; onRemoveAfter?: (id: string) => void;
    onShow?: (id: string) => void; onComment?: (row: string) => void; onShape?: (shape: Shape) => void; onPlayFrom: (id: string) => void; onNotice: (message: string) => void;
  } = $props();

  // The drawer (SB-4): folded or open at any time, playing or not; this browser remembers it for every script. It
  // starts folded. It replaced SB-2's Unpin and the old Hide.
  const KEY = 'timeline-open';
  let hidden = $state(recall(KEY) !== '1');
  const fold = (on: boolean) => ((auto = false), (byTour = false), keep(KEY, (hidden = on) ? '' : '1'));
  // The tour (Tour.svelte) opens the drawer for its timeline step and folds it again after, only if it opened it.
  // Neither is remembered.
  let byTour = false;
  $effect(() => {
    const tour = (e: Event) => {
      if ((e as CustomEvent<boolean>).detail) {
        if (hidden) (hidden = false), (auto = false), (byTour = true);
      } else if (byTour) (hidden = true), (byTour = false);
    };
    addEventListener('tour-drawer', tour);
    return () => removeEventListener('tour-drawer', tour);
  });
  // SB-5 (board 77): folded, a push past the bottom of the page (scrolling down again once there) unfolds it, and
  // scrolling up folds it again, but only if it opened so: opened with its bar, it stays. Neither is remembered.
  // Not while playing (Play moves the page itself). Only reaching the bottom does nothing, so the page's height
  // changing as it opens can't make it flicker: the push must start once the page has been at the bottom a moment
  // (wheel events are passive, so the one that scrolls to the bottom can arrive after that scroll; and a flick's
  // momentum keeps sending them, which counts as the same push).
  let auto = $state(false);
  let section = $state<HTMLElement>();
  const atBottom = () => innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
  let bottomSince = 0; // when the page reached the bottom, 0 while it isn't there
  let lastPush = 0; // the last wheel, key or touch: a gap of more than PAUSE starts a new push
  let pushFromBottom = false; // this push started with the page already at the bottom for a moment
  const PAUSE = 200;
  function scrolled(down: boolean, target: EventTarget | null) {
    const now = performance.now();
    if (now - lastPush > PAUSE) pushFromBottom = bottomSince > 0 && now - bottomSince > PAUSE;
    lastPush = now;
    if (player.started || (target instanceof Node && section?.contains(target))) return;
    if (down && hidden && pushFromBottom && atBottom()) (hidden = false), (auto = true);
    else if (!down && auto) (hidden = true), (auto = false);
  }
  const onScroll = () => (bottomSince = atBottom() ? bottomSince || performance.now() : 0);
  const DOWN = new Set(['PageDown', 'End', 'ArrowDown', ' ']);
  const UP = new Set(['PageUp', 'Home', 'ArrowUp']);
  let touchY = 0;
  $effect(() => {
    const wheel = (e: WheelEvent) => {
      if (e.deltaY && !(e.target as Element).closest?.('aside')) scrolled(e.deltaY > 0, e.target); // the side panel scrolls itself
    };
    const key = (e: KeyboardEvent) => {
      if ((e.target as Element).closest?.('input, textarea, select, button, [contenteditable]')) return;
      if (DOWN.has(e.key) || UP.has(e.key)) scrolled(DOWN.has(e.key), e.target);
    };
    const touchStart = (e: TouchEvent) => (touchY = e.touches[0]?.clientY ?? 0);
    const touchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? touchY;
      if (Math.abs(y - touchY) > 24) scrolled(y < touchY, e.target), (touchY = y); // finger up: the page goes down
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('wheel', wheel, { passive: true });
    addEventListener('keydown', key);
    addEventListener('touchstart', touchStart, { passive: true });
    addEventListener('touchmove', touchMove, { passive: true });
    return () => {
      removeEventListener('scroll', onScroll);
      removeEventListener('wheel', wheel);
      removeEventListener('keydown', key);
      removeEventListener('touchstart', touchStart);
      removeEventListener('touchmove', touchMove);
    };
  });
  let zoom = $state(1);
  // Issue #243: the timeline opens at the zoom that shows the most rows with room to read them (fitZoom), measured
  // the first time it opens with something on it; once zoomed by hand, it stays where it was put.
  let zoomed = false;
  function fit(node: HTMLElement) {
    if (!zoomed) zoom = fitZoom(laid.blocks.filter((b) => b.kind === 'row').map((b) => b.seconds), total, node.clientWidth);
    zoomed = true;
  }
  const zoomBy = (f: number) => ((zoomed = true), (zoom = Math.min(ZOOM_MAX, Math.max(1, zoom * f))));
  // Issue #245 (board 80): open, the strip stays above the tracks with a box around the part in view, in % of the
  // whole; kept up to date as the tracks scroll, zoom (they change width) or the window resizes.
  let view = $state({ left: 0, width: 100 });
  function inView(node: HTMLElement) {
    const see = () => {
      const w = node.scrollWidth || 1;
      view = { left: (node.scrollLeft / w) * 100, width: Math.min(100, (node.clientWidth / w) * 100) };
    };
    const seen = new ResizeObserver(see);
    seen.observe(node);
    if (node.firstElementChild) seen.observe(node.firstElementChild);
    node.addEventListener('scroll', see, { passive: true });
    see();
    return { destroy: () => (seen.disconnect(), node.removeEventListener('scroll', see)) };
  }
  // The page keeps the drawer's height as its bottom scroll padding, so a row brought into view (a click on a block,
  // Play following the rows, the cursor) isn't left behind the drawer; and as --drawer, which lifts the corner links,
  // Undo and the messages above it.
  function room(node: HTMLElement) {
    const html = document.documentElement;
    const seen = new ResizeObserver(() => {
      html.style.scrollPaddingBottom = `${node.offsetHeight}px`;
      html.style.setProperty('--drawer', `${node.offsetHeight}px`);
    });
    seen.observe(node);
    return { destroy: () => { seen.disconnect(); html.style.scrollPaddingBottom = ''; html.style.removeProperty('--drawer'); } };
  }

  // Where a row's cut times come from (SB-8): heard in its take, or estimated from the line.
  function timedBy(row: Row) {
    const take = voice.takes[row.id];
    if (!take) return 'Cuts estimated (no take).';
    if (take.words) return heardWords(row.dialogue, take.words, 0, take.seconds) ? 'Cuts timed from the take.' : 'Cuts estimated: the take’s words weren’t heard.';
    if (voice.hearing === row.id) return 'Cuts estimated until the take is heard…';
    return voice.failed ? 'Cuts estimated: the take couldn’t be heard.' : 'Cuts estimated until the take is heard.';
  }

  // Each row lasts its take, or its read time without one, as Play the script times it.
  const upright = $derived(shapeOf(script.front) === 'upright');
  const laid = $derived(layout(script, rowLength(voice.takes, speaking.wpm)));
  const total = $derived(laid.total);
  // SB-8: the takes of rows cut on a word are heard once (Write only), so their cuts fall where the words are said.
  const toHear = $derived(laid.blocks.filter((b) => b.kind === 'row' && b.take && b.shots.length > 1 && !voice.takes[b.id]?.words
    && readChoices(byId.get(b.id)?.timeline ?? '').cuts.length).map((b) => b.id).join(' '));
  $effect(() => {
    if (!readOnly && toHear) voice.hearAll(dir, toHear.split(' '));
  });
  const byId = $derived(new Map(rows(script).map((r) => [r.id, r])));
  const numbers = $derived(new Map(rows(script).map((r, i) => [r.id, i + 1])));
  const pct = (seconds: number) => (total ? (seconds / total) * 100 : 0);
  const secs = (s: number) => `${Math.round(s * 10) / 10} s`;

  // Ruler marks: a round step giving about 12 marks across the width (more when zoomed in).
  const ticks = $derived.by(() => {
    const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const step = steps.find((s) => total / s <= 12 * zoom) ?? 600;
    const list: number[] = [];
    for (let t = 0; t < total - step / 3; t += step) list.push(t); // none squeezed in at the right end
    return list;
  });

  // The pictures, as blob URLs from the script's folder, made while the timeline is open and freed after. Like the
  // previews (AP-39), only once it comes near the screen: opening a script doesn't wait on the timeline's work.
  let shown = $state(false);
  // A video's block shows a still from its start (#205: it was a dark chip with its name, which looked unloaded),
  // made as Assets' thumbnails are (lib/preview.ts); the preview while playing plays the video itself.
  let urls = $state<Record<string, string>>({});
  let stills = $state<Record<string, string>>({});
  const paths = $derived([...new Set(rows(script).flatMap((r) => pictureFiles(r).map((p) => p.path)))].join('\n'));
  $effect(() => {
    const list = paths ? paths.split('\n') : [];
    if ((hidden && !(player.started && previewOn)) || !shown) return; // folded, still made while playing, for the preview
    let gone = false;
    const made: string[] = [];
    const previews: Preview[] = [];
    (async () => {
      const next: Record<string, string> = {};
      const files: [string, File][] = [];
      for (const path of list) {
        const file = await assetFile(dir, path);
        if (gone) return;
        if (file) made.push((next[path] = URL.createObjectURL(file)));
        if (file && isVideo(path)) files.push([path, file]);
      }
      urls = next;
      const still: Record<string, string> = {};
      for (const [path, file] of files) {
        const preview = await makePreview(file, path);
        if (gone) return revokePreview(preview);
        if (preview?.kind !== 'video') continue;
        previews.push(preview);
        URL.revokeObjectURL(preview.url); // only the still is used here
        still[path] = preview.still;
        stills = { ...still };
      }
    })();
    return () => {
      gone = true;
      made.forEach((u) => URL.revokeObjectURL(u));
      previews.forEach((p) => p.kind === 'video' && URL.revokeObjectURL(p.still));
    };
  });

  // Waveforms of the takes, by row id, made once each.
  let waves = $state<Record<string, string>>({});
  $effect(() => {
    if (hidden || !shown) return;
    for (const [id, take] of Object.entries(voice.takes)) {
      waveform(dir, id, take).then((peaks) => {
        if (peaks && waves[id] !== wavePath(peaks)) waves = { ...waves, [id]: wavePath(peaks) };
      });
    }
  });

  const block = $derived(laid.blocks.find((b) => b.id === selected));
  const selRow = $derived(block?.kind === 'row' ? byId.get(block.id) : undefined);
  const selAfter = $derived(block && block.kind !== 'row' ? readChoices(byId.get(block.after)?.timeline ?? '').after : null);

  // Playing (PR 3): a playhead runs along the timeline (along the thin strip when folded) and a preview shows the
  // picture of the moment above the drawer's right end; ⤢ makes the preview big.
  const now = $derived(player.started ? laid.blocks.find((b) => b.id === player.row) : undefined);
  const into = $derived(Math.min(player.elapsed, now?.seconds ?? 0));
  let big = $state(false);
  // ✕ closes the preview (#225, board 80); it stays closed while playing, in this browser for every script, until
  // Show preview in the drawer's bar brings it back.
  const PREVIEW = 'timeline-preview';
  let previewOn = $state(recall(PREVIEW) !== 'closed');
  const showPreview = (on: boolean) => keep(PREVIEW, (previewOn = on) ? '' : 'closed');
  // The picture(s) on screen: a sequence's shot of the moment, a collage's all, a hold the last one before it.
  const showing = $derived.by((): { paths: string[]; card: string; tag: string } => {
    if (!now) return { paths: [], card: '', tag: '' };
    if (now.kind !== 'row') {
      if (now.kind === 'placeholder') return { paths: [], card: `Placeholder${now.label ? `: ${now.label}` : ''}`, tag: 'Placeholder' };
      const before = laid.blocks.slice(0, laid.blocks.indexOf(now)).findLast((b) => b.kind === 'row');
      const last = before?.kind === 'row' ? (before.collage ? before.picks : before.shots.slice(-1).map((s) => s.path)) : [];
      return { paths: last, card: last.length ? '' : 'Hold', tag: 'Hold' };
    }
    const n = numbers.get(now.id);
    if (!now.picks.length) return { paths: [], card: plain(byId.get(now.id)?.onScreen ?? '').trim() || `Row ${n}`, tag: `Row ${n}` };
    if (now.collage) return { paths: now.picks, card: '', tag: `Row ${n} · collage` };
    const i = Math.max(0, now.shots.findLastIndex((s) => s.start <= into));
    return { paths: [now.shots[i].path], card: '', tag: `Row ${n}${now.shots.length > 1 ? ` · ${i + 1} of ${now.shots.length}` : ''}` };
  });

  // Cut on a word (the user's pick on board 63): in a sequence, a click on a word starts the next picture just
  // before it (board 78). With every cut used, a click moves the nearest cut there; the first word takes none.
  function toggleCut(row: Row, at: number, room: number) {
    if (at === 0) return;
    const words = dialogueWords(row.dialogue);
    const c = readChoices(row.timeline);
    const on = cutPositions(words, c.cuts);
    let next = on.includes(at) ? on.filter((i) => i !== at) : [...on, at];
    if (next.length > room) {
      const near = on.reduce((a, b) => (Math.abs(b - at) < Math.abs(a - at) ? b : a));
      next = next.filter((i) => i !== near);
    }
    next.sort((a, b) => a - b);
    onTimeline(row.id, changeChoices(row, (x) => (x.cuts = cutWords(words, next))));
  }

  let tipFor = $state(''); // the block hovered or focused, whose dialogue shows above it
  let tipEnd = $state(false); // the block is near the timeline's right edge: its text lines up with the block's right (UX-8)
  function showTip(b: TimeBlock, e: Event) {
    tipFor = b.id;
    const el = e.currentTarget as HTMLElement;
    const box = el.closest('.scroll')?.getBoundingClientRect();
    tipEnd = !!box && el.getBoundingClientRect().left + TIP > Math.min(box.right, innerWidth);
  }
  const TIP = 280; // the hover text's width, padding included
  let quiet = $state(-1); // the word just clicked: no "a cut would go here" line until the pointer leaves it

  function pick(b: TimeBlock) {
    if (readOnly) return onComment(b.kind === 'row' ? b.id : b.after);
    selected = selected === b.id ? '' : b.id;
    // The drawer never leaves the screen, so a click brings its row into view while the panel stays at hand.
    if (selected) onShow(b.kind === 'row' ? b.id : b.after);
  }

  const tip = (b: TimeBlock) => {
    if (b.kind === 'hold') return `Hold · ${secs(b.seconds)} on the last picture`;
    if (b.kind === 'placeholder') return `Placeholder · ${secs(b.seconds)}${b.label ? ` — ${b.label}` : ''}`;
    const row = byId.get(b.id);
    return `Row ${numbers.get(b.id)} · ${secs(b.seconds)}${row?.dialogue.trim() ? ` — “${plain(row.dialogue).trim()}”` : ''}`;
  };

  // The row panel's choices.
  function toggle(row: Row, path: string) {
    onTimeline(row.id, changeChoices(row, (c) => {
      c.without = c.without.includes(path) ? c.without.filter((p) => p !== path) : [...c.without, path];
    }));
  }
  const setCollage = (row: Row, on: boolean) => onTimeline(row.id, changeChoices(row, (c) => (c.collage = on)));
  function addAfter(row: Row, kind: After['kind']) {
    onTimeline(row.id, changeChoices(row, (c) => (c.after = kind === 'hold' ? { kind, seconds: 2 } : { kind, seconds: 3, label: '' })));
    selected = `${kind}:${row.id}`;
  }
  const setAfter = (id: string, after: After) => {
    const row = byId.get(id);
    if (row) onTimeline(id, changeChoices(row, (c) => (c.after = after)));
  };

  let picker = $state<HTMLInputElement>();
  async function addPictures(row: Row) {
    const chosen = Array.from(picker?.files ?? []);
    if (picker) picker.value = '';
    try {
      const added: string[] = [];
      for (const file of chosen) added.push(markTimelineOnly(await addAsset(dir, file)));
      if (added.length) onFiles(row.id, [...row.files, ...added]);
    } catch (e) {
      onNotice(problem("The picture couldn't be copied into the script's folder.", 'adding a picture to the timeline', e));
    }
  }
</script>

<section class="timeline" class:folded={hidden} aria-label="Timeline" data-tour={readOnly ? 'review-timeline' : 'timeline'} bind:this={section} use:near={() => (shown = true)} use:room>
  {#if now && previewOn}
    <div class="preview" class:big class:upright role="img" aria-label="Preview: {showing.tag}">
      <div class="screen">
        <PreviewShot paths={showing.paths} {urls} {upright} />
        {#if showing.card}<span class="pcard" class:ph={now.kind === 'placeholder'}>{showing.card}</span>{/if}
        <span class="tag">{showing.tag}</span>
      </div>
      <div class="pbar">
        <span>{clock(player.time)} / {clock(player.total)}</span>
        <button aria-label={big ? 'Make the preview small' : 'Make the preview big'} title={big ? 'Make the preview small' : 'Make the preview big'} onclick={() => (big = !big)}>{big ? '⤡' : '⤢'}</button>
        <button aria-label="Close the preview" title="Close the preview" onclick={() => showPreview(false)}>✕</button>
      </div>
    </div>
  {/if}
  <div class="top">
    <!-- The whole bar folds and unfolds the drawer; folded, a thin strip of the blocks (and the playhead) shows. -->
    <button class="foldbar" aria-expanded={!hidden} onclick={() => fold(!hidden)}>
      <svg class="chev" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24"><path d="M6 15l6-6 6 6" /></svg>
      <span class="title">Timeline</span>
      {#if total}<span class="sum">{clock(total)}{#if !hidden}{' '}<span class="help">· {readOnly ? 'click a block to comment on its row' : 'from the takes, read time where there is none'}</span>{/if}</span>{/if}
      {#if hidden && total}
        {@render strip(false)}
      {:else}
        <span class="grow"></span>
      {/if}
    </button>
    {#if now && !previewOn}
      <button class="show" onclick={() => showPreview(true)}>Show preview</button>
    {/if}
    {#if !hidden && total && !readOnly}
      <span class="segs shape" role="group" aria-label="Video shape" title="The shape of the preview, its collages and the exported video">
        <button aria-pressed={!upright} class:on={!upright} onclick={() => onShape('wide')}>Wide</button>
        <button aria-pressed={upright} class:on={upright} onclick={() => onShape('upright')}>Upright</button>
      </span>
    {/if}
    {#if !hidden && total}
      <span class="zoom" role="group" aria-label="Zoom">
        <button aria-label="Zoom out" title="Zoom out" disabled={zoom <= 1} onclick={() => zoomBy(1 / 2)}>−</button>
        <button aria-label="Zoom in" title="Zoom in" disabled={zoom >= ZOOM_MAX} onclick={() => zoomBy(2)}>+</button>
      </span>
    {/if}
    <!-- Fold sits at the far right, after Wide / Upright and zoom (#238, board 80); the bar still folds too. -->
    <button class="fold" aria-expanded={!hidden} onclick={() => fold(!hidden)}>{hidden ? 'Unfold' : 'Fold'}</button>
  </div>

  {#if !hidden}
  <div class="body" transition:slide={{ duration: 150 }}>
    {#if !total}
      <p class="empty help">The timeline fills in as rows get dialogue or a take.</p>
    {:else}
      {@render strip(true)}
      <div class="scroll" use:fit use:inView>
        <div class="tracks" style:width="{zoom * 100}%">
          <div class="ruler" aria-hidden="true">
            {#each ticks as t (t)}<span style:left="{pct(t)}%">{clock(t)}</span>{/each}
          </div>
          <div class="lane">
            {#each laid.lanes as lane (lane.start + lane.title)}
              <button class="sec" style:left="{pct(lane.start)}%" style:width="{pct(lane.seconds)}%" title="{lane.title} · {clock(lane.seconds)}"
                onclick={() => lane.first && onShow(lane.first)}>{lane.title || 'Untitled section'} <span>· {clock(lane.seconds)}</span></button>
            {/each}
          </div>
          <div class="lane blocks">
            {#each laid.blocks as b (b.id)}
              {@const row = b.kind === 'row' ? byId.get(b.id) : undefined}
              <button class="blk {b.kind}" class:on={selected === b.id} class:now={now?.id === b.id} style:left="{pct(b.start)}%" style:width="{pct(b.seconds)}%"
                aria-label={tip(b)} aria-pressed={selected === b.id} onclick={() => pick(b)}
                onmouseenter={(e) => showTip(b, e)} onmouseleave={() => (tipFor = '')} onfocus={(e) => showTip(b, e)} onblur={() => (tipFor = '')}>
                {#if b.kind === 'row'}
                  {#if !b.picks.length}
                    <span class="card">{plain(row?.onScreen ?? '').trim() || 'No picture'}</span>
                  {:else if b.collage}
                    <span class="collage">
                      {#each b.picks as path (path)}{@render picture(path)}{/each}
                    </span>
                  {:else}
                    <span class="seq">
                      {#each b.shots as shot (shot.path)}
                        <span class="shot" style:width="{(shot.seconds / b.seconds) * 100}%">{@render picture(shot.path)}</span>
                      {/each}
                    </span>
                  {/if}
                  <span class="n">{numbers.get(b.id)}</span>
                  {#if b.picks.length > 1}<span class="mode">{b.collage ? 'Collage' : `Sequence · ${b.picks.length}`}</span>{/if}
                {:else if b.kind === 'hold'}
                  <span class="hold-in">❚❚ Hold<small>{secs(b.seconds)}</small></span>
                {:else}
                  <span class="ph-in">Placeholder · {secs(b.seconds)}<small>{b.label}</small></span>
                {/if}
                {#if tipFor === b.id}<span class="tip" class:end={tipEnd} aria-hidden="true">{tip(b)}</span>{/if}
              </button>
            {/each}
          </div>
          {#if now}<span class="head" aria-hidden="true" style:left="{pct(player.time)}%"></span>{/if}
          <div class="lane voice">
            {#each laid.blocks as b (b.id)}
              {#if b.kind === 'row'}
                <span class="vo" class:said={b.take} style:left="{pct(b.start)}%" style:width="{pct(b.seconds)}%">
                  {#if b.take && waves[b.id]}
                    <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Take, {secs(b.seconds)}"><path d={waves[b.id]} /></svg>
                  {:else if !b.take}
                    <span class="read">no take · read time {secs(b.seconds)}</span>
                  {/if}
                </span>
              {/if}
            {/each}
          </div>
        </div>
      </div>

      {#if player.started || readOnly}
        <!-- While playing (and in Review), only the tracks: the panel comes back when it stops. -->
      {:else if selRow && block?.kind === 'row'}
        {@const files = pictureFiles(selRow)}
        {@const c = readChoices(selRow.timeline)}
        <div class="panel">
          <div class="line">
            <strong>Row {numbers.get(selRow.id)} · {secs(block.seconds)}</strong>
            <span class="muted">{block.take ? 'from its take' : 'read time (no take yet)'}</span>
          </div>
          <div class="line">
            {#each files as f (f.path)}
              {@const on = !c.without.includes(f.path)}
              <button class="pick" class:off={!on} aria-pressed={on} onclick={() => toggle(selRow, f.path)}>
                <span class="mini">{@render picture(f.path)}</span>{on ? '✓' : '○'} {f.path.split('/').at(-1)}{#if f.timelineOnly}<span class="muted"> · timeline only</span>{/if}
              </button>
            {/each}
            <button class="add" onclick={() => picker?.click()}>+ Add a picture</button>
            <input type="file" accept="image/*,video/*" multiple hidden bind:this={picker} onchange={() => addPictures(selRow)} />
            <span class="grow"></span>
            {#if block.picks.length > 1}
              <span class="segs" role="group" aria-label="How the pictures show">
                <button aria-pressed={!c.collage} class:on={!c.collage} onclick={() => setCollage(selRow, false)}>Sequence</button>
                <button aria-pressed={c.collage} class:on={c.collage} onclick={() => setCollage(selRow, true)}>Collage</button>
              </span>
            {/if}
            {#if canPlay}<button class="play" onclick={() => onPlayFrom(selRow.id)}>▶ Play from here</button>{/if}
          </div>
          {#if block.picks.length > 1 && !c.collage}
            {@const words = dialogueWords(selRow.dialogue)}
            {@const cuts = cutPositions(words, c.cuts)}
            <div class="line words" role="group" aria-label="Cut on a word">
              <span class="muted">Cut on a word:</span>
              <span class="said">
                {#each words as w, i (i)}
                  {@const n = cuts.filter((x) => x <= i).length}
                  {#if cuts.includes(i)}<span class="mark" aria-hidden="true"><span class="num">{n + 1}</span></span>{/if}
                  <button class="word" class:cut={cuts.includes(i)} class:quiet={quiet === i} onmouseleave={() => (quiet = -1)}
                    aria-pressed={cuts.includes(i)} disabled={i === 0}
                    title={i === 0 ? 'Picture 1 starts here' : cuts.includes(i) ? `Picture ${n + 1} starts just before “${w}”: click to take the cut off` : `Cut just before “${w}”`}
                    onclick={() => { quiet = i; toggleCut(selRow, i, block.picks.length - 1); }}>{w}</button>
                {/each}
              </span>
              <span class="help">{block.picks.length} pictures: up to {block.picks.length - 1} cuts. Each starts the next picture just before its word; without them they share the time equally.</span>
              <span class="timed">{timedBy(selRow)}</span>
            </div>
          {/if}
          <p class="foot">
            {#if !c.after}After this row: <button class="link" onclick={() => addAfter(selRow, 'hold')}>+ Hold</button> · <button class="link" onclick={() => addAfter(selRow, 'placeholder')}>+ Placeholder</button> · {/if}
            <span class="help">{!files.length ? 'No pictures yet: its On screen words show instead.' : block.picks.length < 2 ? 'One picture fills the row’s time.' : c.collage ? 'Collage: all at once, side by side, for the whole row.' : 'Sequence: one after another, sharing the row’s time.'}</span>
          </p>
        </div>
      {:else if selAfter && block && block.kind !== 'row'}
        <div class="panel">
          <div class="line">
            <strong>{block.kind === 'hold' ? 'Hold' : 'Placeholder'} after row {numbers.get(block.after)}</strong>
            <AfterEditor after={selAfter} n={numbers.get(block.after) ?? 0} onSet={(a) => setAfter(block.after, a)} />
            <span class="grow"></span>
            <button class="remove" onclick={() => { onRemoveAfter(block.after); selected = block.after; }}>✕ Remove</button>
          </div>
        </div>
      {/if}
    {/if}
  </div>
  {/if}
</section>

{#snippet picture(path: string)}
  {#if isVideo(path) && stills[path]}
    <span class="still"><img src={stills[path]} alt="" /><span class="badge" aria-hidden="true">▶</span></span>
  {:else if isVideo(path)}
    <span class="vid" aria-hidden="true">▶ {path.split('/').at(-1)}</span>
  {:else if urls[path]}
    <img src={urls[path]} alt="" />
  {:else}
    <span class="gap" aria-hidden="true"></span>
  {/if}
{/snippet}

<!-- The thin strip of the whole script: in the bar when folded; open, above the tracks with a box around the part in
     view (#245). A picked block lights up in it; the playhead only while playing. -->
{#snippet strip(open: boolean)}
  <span class="strip" class:open aria-hidden="true">
    {#each laid.blocks as b (b.id)}<span class:on={selected === b.id} class:now={now?.id === b.id} style:left="{pct(b.start)}%" style:width="{pct(b.seconds)}%"></span>{/each}
    {#if open}<span class="view" style:left="{view.left}%" style:width="{view.width}%"></span>{/if}
    {#if now}<span class="head" style:left="{pct(player.time)}%"></span>{/if}
  </span>
{/snippet}

<style>
  /* The drawer (SB-4): sticks to the bottom of the screen; at the end of the script it rests under the last row, so
     that row is never hidden behind it. Open, at most about half the screen: the rest scrolls inside .body (not the
     section, which would clip the preview above it). */
  .timeline { position: sticky; bottom: 0; z-index: 4; margin-top: 32px; padding: 0 16px; border: 1px solid var(--line); border-bottom: 0; border-radius: 12px 12px 0 0; background: var(--ground); box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.08); }
  .body { max-height: calc(50vh - 48px); overflow-y: auto; padding-bottom: 16px; }
  .foldbar { flex: 1 1 320px; display: flex; align-items: center; gap: 12px; min-width: 0; min-height: 44px; padding: 0; border: 0; background: none; font: inherit; color: inherit; text-align: left; cursor: pointer; }
  .chev { flex: none; fill: none; stroke: var(--accent); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transform: rotate(180deg); }
  .folded .chev { transform: none; }
  .title { font-size: 14px; font-weight: 600; }
  .strip { position: relative; flex: 1; min-width: 60px; height: 8px; }
  .strip span { position: absolute; top: 0; bottom: 0; box-sizing: border-box; border-right: 2px solid var(--ground); border-radius: 3px; background: #c9d7f2; }
  .strip span.on { background: var(--accent); }
  .strip span.now { background: #f2c3ad; }
  .strip.open { display: block; height: 8px; margin: 4px 0 10px; }
  .strip .view { top: -4px; bottom: -4px; border: 1.5px solid #6b7fa8; border-radius: 4px; background: rgba(42, 91, 215, 0.06); }
  .strip .head { top: -4px; bottom: -4px; border: 0; border-radius: 0; background: #d9480f; }
  .head { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: #d9480f; pointer-events: none; z-index: 2; }
  .blk.now { box-shadow: inset 0 0 0 2px #d9480f; }
  /* The preview's picture is never taller than the room between the top bar and the drawer (less its 12 px gap, a
     12 px margin and the 40 px bar under the picture), so upright and big never run off the top of the screen. */
  .preview { --room: calc(100vh - var(--bar-h, 0px) - var(--drawer, 0px) - 64px); position: absolute; right: 16px; bottom: calc(100% + 12px); width: min(320px, calc(var(--room) * 16 / 9)); border-radius: 10px; overflow: hidden; background: #0b0b0b; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25); }
  .preview.big { width: min(720px, calc(100vw - 64px), calc(var(--room) * 16 / 9)); }
  .preview.upright { width: min(180px, calc(var(--room) * 9 / 16)); }
  .preview.upright.big { width: min(405px, calc(100vw - 64px), calc(var(--room) * 9 / 16)); }
  .upright .screen { aspect-ratio: 9 / 16; }
  .shape button { min-height: 28px; padding: 0 10px; font-size: 12px; }
  .screen { position: relative; aspect-ratio: 16 / 9; display: flex; }
  .pcard { position: relative; flex: 1; display: flex; align-items: center; justify-content: center; padding: 12px; color: #dadada; font-size: 13px; text-align: center; background: #222; }
  .pcard.ph { background: repeating-linear-gradient(135deg, #2b2b2b 0 10px, #333 10px 20px); }
  .tag { position: absolute; left: 8px; top: 8px; padding: 2px 6px; border-radius: 4px; background: rgba(0, 0, 0, 0.6); color: #fff; font-size: 11px; }
  .pbar { display: flex; align-items: center; gap: 6px; padding: 6px 8px; color: #dadada; font-size: 12px; font-variant-numeric: tabular-nums; }
  .pbar span { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pbar button { min-width: 32px; height: 28px; padding: 0; line-height: 1; border: 1px solid #555; border-radius: 6px; background: none; color: #eee; font-size: 12px; }
  .words { gap: 4px; }
  .said { display: flex; flex-wrap: wrap; align-items: center; row-gap: 6px; }
  /* A cut is a line with the next picture's number before its word (board 78, option B). */
  .said { gap: 6px 4px; }
  .word { position: relative; min-height: 28px; padding: 2px 6px; border: 1px solid transparent; border-radius: 6px; background: #fff; font-size: 13px; color: inherit; }
  .word.cut { border-color: var(--accent); background: #eef2fb; color: var(--accent); }
  .word:disabled { cursor: default; opacity: 1; }
  .word:not(:disabled):not([aria-pressed='true']):not(.quiet):hover::before { content: ''; position: absolute; left: -2px; top: -3px; bottom: -3px; border-left: 2px dashed var(--accent); }
  .mark { display: inline-flex; align-items: center; align-self: stretch; gap: 3px; margin-left: 4px; }
  .mark::before { content: ''; align-self: stretch; width: 2px; border-radius: 1px; background: var(--accent); }
  .num { min-width: 16px; height: 16px; padding: 0 3px; box-sizing: border-box; border-radius: 8px; background: var(--accent); color: #fff; font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }
  .words .help, .words .timed { flex-basis: 100%; font-size: 12px; color: var(--muted); }
  .top { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; padding: 2px 0; }
  .timeline:not(.folded) .top { margin-bottom: 6px; }
  .sum { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .grow { flex: 1; }
  .zoom { display: inline-flex; gap: 2px; }
  .zoom button { width: 32px; height: 32px; border: 1px solid var(--line-strong); border-radius: 6px; background: #fff; font-size: 15px; }
  .zoom button:disabled { opacity: 0.4; }
  .show { flex: none; min-height: 32px; padding: 0 10px; font-size: 13px; }
  .fold { flex: none; min-height: 44px; padding: 0 4px; border: 0; background: none; font-size: 13px; color: var(--accent); cursor: pointer; }
  .empty { margin: 0; font-size: 13px; color: var(--muted); }
  .scroll { overflow-x: auto; padding-top: 4px; }
  .tracks { position: relative; min-width: 100%; }
  .ruler { position: relative; height: 18px; margin-bottom: 4px; border-bottom: 1px solid var(--line); }
  .ruler span { position: absolute; bottom: 2px; padding-left: 3px; border-left: 1px solid var(--line-strong); font-size: 10px; line-height: 12px; color: #6b6b6b; font-variant-numeric: tabular-nums; }
  .lane { position: relative; height: 30px; margin-bottom: 4px; }
  .lane.blocks { height: 92px; }
  .lane.voice { height: 34px; margin-bottom: 0; }
  .sec, .blk, .vo { position: absolute; top: 0; bottom: 0; box-sizing: border-box; border: 1.5px solid var(--ground); }
  .sec { padding: 0 10px; border-radius: 7px; background: #ededed; color: #3d3d3d; font-size: 13px; font-weight: 600; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sec span { font-weight: 400; color: #6b6b6b; }
  .blk { padding: 0; border-radius: 7px; background: #fff; box-shadow: inset 0 0 0 1px #e0e0e0; overflow: visible; text-align: left; }
  .blk.on { box-shadow: inset 0 0 0 2px var(--accent); }
  .blk:hover { filter: brightness(0.97); }
  .seq, .collage, .card, .hold-in, .ph-in { position: absolute; inset: 1px; display: flex; overflow: hidden; border-radius: 6px; }
  .seq { gap: 2px; padding: 2px; }
  .shot { height: 100%; flex: none; overflow: hidden; border-radius: 3px; }
  .collage { align-items: center; justify-content: center; background: #f4f4f4; }
  .collage img, .collage .vid, .collage .gap, .collage .still { height: 62px; width: auto; max-width: 48%; margin: 0 1px; }
  .seq img, .seq .vid, .seq .gap, .seq .still { width: 100%; height: 100%; object-fit: cover; display: block; }
  .vid { display: flex; align-items: flex-end; box-sizing: border-box; padding: 4px; background: #2b2b2b; color: #eee; font-size: 10px; overflow: hidden; white-space: nowrap; }
  .gap { display: block; background: #e4e4e4; min-width: 20px; }
  .card { align-items: center; justify-content: center; padding: 8px; background: #f4f4f4; color: var(--muted); font-size: 11px; line-height: 1.35; text-align: center; }
  .hold-in, .ph-in { flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 6px; font-size: 11px; font-weight: 500; color: #3d3d3d; text-align: center; }
  .hold-in { background: repeating-linear-gradient(135deg, #f4f4f4 0 6px, #eaeaea 6px 12px); }
  .ph-in { border: 1px dashed #9a9a9a; background: #fafafa; }
  small { font-size: 11px; font-weight: 400; color: var(--muted); overflow: hidden; text-overflow: ellipsis; max-width: 100%; white-space: nowrap; }
  .n, .mode { position: absolute; top: 4px; padding: 1px 5px; border-radius: 4px; background: rgba(255, 255, 255, 0.92); font-size: 11px; }
  .n { left: 4px; font-weight: 600; }
  .mode { right: 4px; font-size: 10px; color: #3d3d3d; }
  .tip.end { left: auto; right: 0; }
  .tip { position: absolute; left: 0; bottom: calc(100% + 8px); z-index: 6; width: 260px; padding: 8px 10px; border-radius: 8px; background: #141414; color: #f5f5f5; font-size: 12px; line-height: 1.45; box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2); }
  .vo { display: flex; align-items: center; justify-content: center; border-radius: 7px; background: #fafafa; overflow: hidden; }
  .vo.said { background: #f3f6fd; }
  .vo svg { width: 100%; height: 30px; }
  .vo path { stroke: var(--accent); stroke-width: 2; vector-effect: non-scaling-stroke; fill: none; }
  .read { width: calc(100% - 12px); padding: 3px 0; border: 1px dashed #a8a8a8; border-radius: 4px; color: var(--muted); font-size: 11px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .panel { margin-top: 14px; padding: 12px 14px; border-radius: 10px; background: #f7f7f7; display: flex; flex-direction: column; gap: 10px; }
  .line { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; font-size: 13px; }
  .muted { color: var(--muted); }
  .pick { display: inline-flex; align-items: center; gap: 8px; min-height: 40px; padding: 0 12px 0 6px; border: 1px solid var(--accent); border-radius: 8px; background: #fff; font-size: 13px; }
  .pick.off { border-color: var(--line-strong); opacity: 0.65; }
  .mini { display: inline-flex; width: 28px; height: 28px; border-radius: 4px; overflow: hidden; background: #e4e4e4; }
  .mini img, .mini .vid, .mini .still { width: 100%; height: 100%; object-fit: cover; }
  /* A video's still (#205), with a small ▶ so it reads as a clip. */
  .still { position: relative; display: inline-block; overflow: hidden; }
  .still img { width: 100%; height: 100%; max-width: none; margin: 0; object-fit: cover; display: block; }
  .still .badge { position: absolute; left: 3px; bottom: 3px; padding: 0 4px; border-radius: 3px; background: rgb(0 0 0 / 0.55); color: #fff; font-size: 9px; line-height: 14px; }
  .collage .still img { width: auto; }
  .mini .still .badge { display: none; }
  .add { min-height: 40px; padding: 0 12px; border: 1px dashed var(--line-strong); border-radius: 8px; background: none; font-size: 13px; color: #3d3d3d; }
  .segs { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: #e8e8e8; }
  .segs button { min-height: 34px; padding: 0 12px; border: 0; border-radius: 8px; background: none; font-size: 13px; font-weight: 500; }
  .segs button.on { background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
  .play, .remove { min-height: 40px; padding: 0 14px; border: 1px solid var(--line-strong); border-radius: 8px; background: #fff; font-size: 13px; font-weight: 500; }
  .foot { margin: 0; font-size: 12px; color: var(--muted); }
  .foot .link { font-size: 12px; }
</style>
