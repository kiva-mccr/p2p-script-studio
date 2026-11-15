<script lang="ts">
  import { problem } from '../lib/problems';
  import { addAsset, assetFile } from '../lib/folder';
  import { plain } from '../lib/format';
  import { clock, speaking } from '../lib/readtime.svelte';
  import { keep, recall } from '../lib/remember';
  import { markTimelineOnly, rows, type Row, type Script } from '../lib/script';
  import { changeChoices, cutPositions, cutWords, dialogueWords, layout, pictureFiles, readChoices, shapeOf, type After, type Shape, type TimeBlock } from '../lib/timeline';
  import type { Player } from '../lib/play.svelte';
  import { rowLength, type VoiceOver } from '../lib/voice.svelte';
  import { waveform, wavePath } from '../lib/waveform';
  import AfterEditor from './AfterEditor.svelte';
  import { near } from '../lib/near';

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
  const fold = (on: boolean) => keep(KEY, (hidden = on) ? '' : '1');
  let zoom = $state(1);
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

  // Each row lasts its take, or its read time without one, as Play the script times it.
  const upright = $derived(shapeOf(script.front) === 'upright');
  const laid = $derived(layout(script, rowLength(voice.takes, speaking.wpm)));
  const total = $derived(laid.total);
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
  let urls = $state<Record<string, string>>({});
  const paths = $derived([...new Set(rows(script).flatMap((r) => pictureFiles(r).map((p) => p.path)))].join('\n'));
  $effect(() => {
    const list = paths ? paths.split('\n') : [];
    if ((hidden && !player.started) || !shown) return; // folded, still made while playing, for the preview
    let gone = false;
    const made: string[] = [];
    (async () => {
      const next: Record<string, string> = {};
      for (const path of list) {
        const file = await assetFile(dir, path);
        if (gone) return;
        if (file) made.push((next[path] = URL.createObjectURL(file)));
      }
      urls = next;
    })();
    return () => {
      gone = true;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  });
  const isVideo = (path: string) => /\.(mp4|webm|mov|m4v)$/i.test(path);

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
  const TINTS = 4; // the colours a sequence's pictures take in turn, on the picked block and its words (board 78)

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

<section class="timeline" class:folded={hidden} aria-label="Timeline" data-tour={readOnly ? 'review-timeline' : 'timeline'} use:near={() => (shown = true)} use:room>
  {#if now}
    <div class="preview" class:big class:upright role="img" aria-label="Preview: {showing.tag}">
      <div class="screen" class:collage-on={showing.paths.length > 1}>
        {#each showing.paths as path (path)}
          {#if isVideo(path) && urls[path]}
            <video src={urls[path]} autoplay muted playsinline></video>
          {:else if urls[path]}
            <img src={urls[path]} alt="" />
          {:else}
            <span class="vid">{path.split('/').at(-1)}</span>
          {/if}
        {/each}
        {#if showing.card}<span class="pcard" class:ph={now.kind === 'placeholder'}>{showing.card}</span>{/if}
        <span class="tag">{showing.tag}</span>
      </div>
      <div class="pbar">
        <span>{clock(player.time)} / {clock(player.total)}</span>
        <button aria-label={big ? 'Make the preview small' : 'Make the preview big'} title={big ? 'Make the preview small' : 'Make the preview big'} onclick={() => (big = !big)}>{big ? '⤡' : '⤢'}</button>
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
        <span class="strip" aria-hidden="true">
          {#each laid.blocks as b (b.id)}<span class:now={now?.id === b.id} style:left="{pct(b.start)}%" style:width="{pct(b.seconds)}%"></span>{/each}
          {#if now}<span class="head" style:left="{pct(player.time)}%"></span>{/if}
        </span>
      {:else}
        <span class="grow"></span>
      {/if}
      <span class="fold">{hidden ? 'Unfold' : 'Fold'}</span>
    </button>
    {#if !hidden && total && !readOnly}
      <span class="segs shape" role="group" aria-label="Video shape" title="The shape of the preview, its collages and the exported video">
        <button aria-pressed={!upright} class:on={!upright} onclick={() => onShape('wide')}>Wide</button>
        <button aria-pressed={upright} class:on={upright} onclick={() => onShape('upright')}>Upright</button>
      </span>
    {/if}
    {#if !hidden && total}
      <span class="zoom" role="group" aria-label="Zoom">
        <button aria-label="Zoom out" title="Zoom out" disabled={zoom <= 1} onclick={() => (zoom = Math.max(1, zoom / 2))}>−</button>
        <button aria-label="Zoom in" title="Zoom in" disabled={zoom >= 16} onclick={() => (zoom = Math.min(16, zoom * 2))}>+</button>
      </span>
    {/if}
  </div>

  {#if !hidden}
  <div class="body">
    {#if !total}
      <p class="empty help">The timeline fills in as rows get dialogue or a take.</p>
    {:else}
      <div class="scroll">
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
                      {#each b.shots as shot, i (shot.path)}
                        <span class="shot t{i % TINTS}" class:tinted={selected === b.id} style:width="{(shot.seconds / b.seconds) * 100}%">{@render picture(shot.path)}</span>
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
                  <button class="word t{n % TINTS}" class:start={i === 0 || cuts.includes(i)} class:end={i === words.length - 1 || cuts.includes(i + 1)}
                    class:quiet={quiet === i} onmouseleave={() => (quiet = -1)}
                    aria-pressed={cuts.includes(i)} disabled={i === 0}
                    title={i === 0 ? 'Picture 1 starts here' : cuts.includes(i) ? `Picture ${n + 1} starts just before “${w}”: click to take the cut off` : `Cut just before “${w}”`}
                    onclick={() => { quiet = i; toggleCut(selRow, i, block.picks.length - 1); }}>{w}</button>
                {/each}
              </span>
              <span class="help">{block.picks.length} pictures: up to {block.picks.length - 1} cuts. Each starts the next picture just before its word; without them they share the time equally.</span>
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
  {#if isVideo(path)}
    <span class="vid" aria-hidden="true">▶ {path.split('/').at(-1)}</span>
  {:else if urls[path]}
    <img src={urls[path]} alt="" />
  {:else}
    <span class="gap" aria-hidden="true"></span>
  {/if}
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
  .strip span.now { background: #f2c3ad; }
  .strip .head { top: -4px; bottom: -4px; border: 0; border-radius: 0; background: #d9480f; }
  .head { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: #d9480f; pointer-events: none; z-index: 2; }
  .blk.now { box-shadow: inset 0 0 0 2px #d9480f; }
  .preview { position: absolute; right: 16px; bottom: calc(100% + 40px); /* above the corner links (AP-28), lifted over the drawer */ width: 320px; border-radius: 10px; overflow: hidden; background: #0b0b0b; box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25); }
  .preview.big { width: min(720px, calc(100vw - 64px)); }
  .preview.upright { width: 180px; }
  .preview.upright.big { width: min(405px, calc(100vw - 64px)); }
  .upright .screen { aspect-ratio: 9 / 16; flex-direction: column; }
  .upright .screen.collage-on { padding: 6% 8%; }
  .upright .screen img, .upright .screen video, .upright .screen .vid { min-height: 0; }
  .shape button { min-height: 28px; padding: 0 10px; font-size: 12px; }
  .screen { position: relative; aspect-ratio: 16 / 9; display: flex; gap: 3px; }
  .screen.collage-on { padding: 8% 6%; box-sizing: border-box; }
  .screen img, .screen video, .screen .vid { flex: 1; min-width: 0; width: 100%; height: 100%; object-fit: contain; }
  .pcard { flex: 1; display: flex; align-items: center; justify-content: center; padding: 12px; color: #dadada; font-size: 13px; text-align: center; background: #222; }
  .pcard.ph { background: repeating-linear-gradient(135deg, #2b2b2b 0 10px, #333 10px 20px); }
  .tag { position: absolute; left: 8px; top: 8px; padding: 2px 6px; border-radius: 4px; background: rgba(0, 0, 0, 0.6); color: #fff; font-size: 11px; }
  .pbar { display: flex; align-items: center; gap: 8px; padding: 6px 8px; color: #dadada; font-size: 12px; font-variant-numeric: tabular-nums; }
  .pbar span { flex: 1; }
  .pbar button { min-width: 32px; min-height: 28px; border: 1px solid #555; border-radius: 6px; background: none; color: #eee; font-size: 12px; }
  .words { gap: 4px; }
  .said { display: flex; flex-wrap: wrap; align-items: center; row-gap: 6px; }
  /* Each picture's words share its tint (board 78); a cut is a line with the next picture's number before its word. */
  .word { position: relative; min-height: 28px; padding: 2px 4px; border: 0; border-radius: 0; font-size: 13px; color: inherit; }
  .word.start { border-radius: 6px 0 0 6px; padding-left: 6px; }
  .word.end { border-radius: 0 6px 6px 0; padding-right: 6px; margin-right: 6px; }
  .word.start.end { border-radius: 6px; }
  .word:disabled { cursor: default; opacity: 1; }
  .word:not(:disabled):not([aria-pressed='true']):not(.quiet):hover::before { content: ''; position: absolute; left: -2px; top: -3px; bottom: -3px; border-left: 2px dashed var(--accent); }
  .t0 { --tint: #e2efda; --edge: #7fae6b; }
  .t1 { --tint: #e3ebfb; --edge: #6f92d8; }
  .t2 { --tint: #fbebd3; --edge: #d4a04f; }
  .t3 { --tint: #eee3f7; --edge: #a586cf; }
  .word { background: var(--tint); }
  .mark { display: inline-flex; align-items: center; align-self: stretch; gap: 3px; margin: 0 4px 0 0; }
  .mark::before { content: ''; align-self: stretch; width: 2px; border-radius: 1px; background: var(--accent); }
  .num { min-width: 16px; height: 16px; padding: 0 3px; box-sizing: border-box; border-radius: 8px; background: var(--accent); color: #fff; font-size: 10px; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; }
  .words .help { flex-basis: 100%; font-size: 12px; color: var(--muted); }
  .top { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 16px; padding: 2px 0; }
  .timeline:not(.folded) .top { margin-bottom: 6px; }
  .sum { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .grow { flex: 1; }
  .zoom { display: inline-flex; gap: 2px; }
  .zoom button { width: 32px; height: 32px; border: 1px solid var(--line-strong); border-radius: 6px; background: #fff; font-size: 15px; }
  .zoom button:disabled { opacity: 0.4; }
  .fold { flex: none; font-size: 13px; color: var(--accent); }
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
  .shot { height: 100%; flex: none; overflow: hidden; border-radius: 3px; box-sizing: border-box; }
  .shot.tinted { border-bottom: 4px solid var(--edge); }
  .collage { align-items: center; justify-content: center; background: #f4f4f4; }
  .collage img, .collage .vid, .collage .gap { height: 62px; width: auto; max-width: 48%; margin: 0 1px; }
  .seq img, .seq .vid, .seq .gap { width: 100%; height: 100%; object-fit: cover; display: block; }
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
  .mini img, .mini .vid { width: 100%; height: 100%; object-fit: cover; }
  .add { min-height: 40px; padding: 0 12px; border: 1px dashed var(--line-strong); border-radius: 8px; background: none; font-size: 13px; color: #3d3d3d; }
  .segs { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: #e8e8e8; }
  .segs button { min-height: 34px; padding: 0 12px; border: 0; border-radius: 8px; background: none; font-size: 13px; font-weight: 500; }
  .segs button.on { background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
  .play, .remove { min-height: 40px; padding: 0 14px; border: 1px solid var(--line-strong); border-radius: 8px; background: #fff; font-size: 13px; font-weight: 500; }
  .foot { margin: 0; font-size: 12px; color: var(--muted); }
  .foot .link { font-size: 12px; }
</style>
