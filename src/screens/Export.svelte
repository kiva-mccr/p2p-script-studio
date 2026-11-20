<script lang="ts" module>
  import type { Column } from '../lib/printcolumns';
  // Print's choices: a Notes column on each row, Notes lines on every page (how many), the text size in %, the columns that
  // print (EX-16), the page turned sideways (EX-18), and the credits after the rows (AP-31).
  export type PrintChoices = { column: boolean; lines: number; scale: number; hidden: Column[]; landscape: boolean; credits: boolean };
  export type Format = 'print' | 'fountain' | 'fdx' | 'voice' | 'edit' | 'video';
</script>

<script lang="ts">
  import { problem } from '../lib/problems';
  import CopyDetails from './CopyDetails.svelte';
  import HelpMenu from './HelpMenu.svelte';
  // The export screen (EX-9, board 27): opened from Export / Share on one format, in place of the script. Formats
  // on the left, the real result in the middle (redrawn as settings change), the settings and Print… or Save on the
  // right. Settings are remembered in this browser; their defaults are what the exports did before.
  import { safeName } from '../lib/folder';
  import { toHtml } from '../lib/format';
  import { toFdx } from '../lib/fdx';
  import { SCREENPLAY, speakerName, toFountain, type Screenplay } from '../lib/fountain';
  import { clock, countWords, speaking } from '../lib/readtime.svelte';
  import { shownCredits, speakers } from '../lib/people';
  import { COLUMNS, readHidden } from '../lib/printcolumns';
  import { keep, recall } from '../lib/remember';
  import { frontValue, rows, type Script } from '../lib/script';
  import { lineUp, mp3File, readClips, wavFile, type Clip } from '../lib/voiceexport';
  import { KBPS } from '../lib/mp3';
  import { sizeText } from '../lib/comments';
  import VoicePreview from './VoicePreview.svelte';
  import Print from './Print.svelte';
  import EditPreview from './EditPreview.svelte';
  import { stillToFind } from '../lib/assets';
  import { EDIT, RATES, SIZES, editFps, editFrame, plan as editPlan } from '../lib/editxml';
  import FrameChoices from './FrameChoices.svelte';
  import { editZip } from '../lib/editmedia';
  import { layout, shapeOf } from '../lib/timeline';
  import VideoPreview from './VideoPreview.svelte';
  import { VIDEO, makeVideo, videoFps, videoFrame } from '../lib/video';
  import { readTakes, rowLength, type Take } from '../lib/voice.svelte';

  // version: "r3", or "" for a draft (Editor's `version()`, which saved what was waiting).
  // missing: the script's files not in the folder (Editor's check), for what placeholders still need (#227).
  let { script, dir, folder, title, version, start, missing: lostFiles = new Set(), onPrint, onBack }: {
    script: Script; dir: FileSystemDirectoryHandle; folder: string; title: string; version: string; start: Format; missing?: Set<string>;
    onPrint: (choices: PrintChoices) => void; onBack: () => void;
  } = $props();

  const FORMATS: { id: Format; name: string; action: string }[] = [
    { id: 'print', name: 'Print / PDF', action: 'Print…' },
    { id: 'fountain', name: 'Fountain (.fountain)', action: 'Save .fountain' },
    { id: 'fdx', name: 'Final Draft (.fdx)', action: 'Save .fdx' },
    { id: 'voice', name: 'Voice-over (.mp3, .wav)', action: 'Save .mp3' },
    { id: 'edit', name: 'Resolve / Premiere (.zip)', action: 'Save .zip' },
    { id: 'video', name: 'Video (.mp4)', action: 'Save video' },
  ];
  // svelte-ignore state_referenced_locally (the screen opens on `start`; the list on the left changes it)
  let format = $state<Format>(start);
  const name = $derived(safeName(title) || 'script');

  // Settings, remembered. Print keeps its keys from before (they were in the Export menu).
  // Notes lines on every page (EX-15): how many, 2 to 8; `lineCount` is kept while they are off.
  const savedCount = Math.min(8, Math.max(2, Number(recall('print-line-count')) || 4));
  let lineCount = $state(savedCount);
  let printing = $state<PrintChoices>({ column: !!recall('print-notes'), lines: recall('print-lines') ? savedCount : 0, scale: Number(recall('print-scale')) || 100,
    hidden: readHidden(recall('print-hide')), landscape: recall('print-page') === 'landscape', credits: recall('export-credits') !== 'off' });
  let fountain = $state<Screenplay>(load('export-fountain', SCREENPLAY));
  let fdx = $state<Screenplay>(load('export-fdx', SCREENPLAY));
  // .mp3 by default (#237): about a tenth the size; .wav for full quality.
  let voiceHow = $state(load('export-voice', { gap: false, silence: false, mp3: true }));
  let edit = $state(load('export-edit', EDIT));
  let video = $state(load('export-video', VIDEO));
  $effect(() => {
    keep('print-notes', printing.column ? '1' : '');
    keep('print-lines', printing.lines ? '1' : '');
    keep('print-line-count', String(lineCount));
    keep('print-scale', String(printing.scale));
    keep('print-hide', printing.hidden.join(','));
    keep('print-page', printing.landscape ? 'landscape' : '');
    keep('export-credits', printing.credits ? '' : 'off');
    keep('export-fountain', JSON.stringify(fountain));
    keep('export-fdx', JSON.stringify(fdx));
    keep('export-voice', JSON.stringify(voiceHow));
    keep('export-edit', JSON.stringify(edit));
    keep('export-video', JSON.stringify(video));
  });
  // Ticks a column on or off; the hidden ones stay in the order they were unticked (their room goes in turns).
  function setLines(on: boolean, count = lineCount) {
    lineCount = Math.min(8, Math.max(2, count));
    printing.lines = on ? lineCount : 0;
  }
  // The preview is one Letter page in CSS px, with Print's margins (14, 12 and 16 mm), so the columns wrap as on paper,
  // shrunk to fit the box's width and 75% of the window's height, but never under 60% (#356).
  let boxWidth = $state(0);
  let windowHeight = $state(800);
  const paper = $derived(printing.landscape ? { w: 1056, h: 816 } : { w: 816, h: 1056 });
  const fit = $derived(boxWidth ? Math.min(1, (boxWidth - 2) / paper.w, Math.max(0.6, (windowHeight * 0.75) / paper.h)) : 1);
  function showColumn(id: Column, on: boolean) {
    printing.hidden = on ? printing.hidden.filter((c) => c !== id) : [...printing.hidden, id];
  }
  function load<T extends object>(key: string, fallback: T): T {
    try {
      return { ...fallback, ...JSON.parse(recall(key) || '{}') };
    } catch {
      return { ...fallback };
    }
  }

  // The title page's line, as print and the exports always had it: "ap1 · Approved", or "Draft".
  const stand = $derived.by(() => {
    const status = frontValue(script.front, 'status');
    return [version || 'Draft', status && status !== 'draft' ? status[0].toUpperCase() + status.slice(1) : ''].filter(Boolean).join(' · ');
  });
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  // The script's credits (AP-31), in every export that has them unless the Credits switch (one for all of them) is off.
  const credits = $derived(shownCredits(script.front));
  const creditsShown = $derived(printing.credits ? credits : []);
  const fountainText = $derived(toFountain(script, title, stand, date, fountain, creditsShown));
  const numbers = $derived.by(() => {
    let n = 0;
    return script.blocks.map((b) => (b.type === 'row' ? ++n : 0));
  });

  // Voice-over: the takes are decoded once, when the format is first picked; the settings only line them up again.
  const RATE = 48000;
  const GAP = 0.5;
  let clips = $state<Clip[] | null>(null);
  let failed = $state(false);
  const VOICE_FAILED = "The voice-over couldn't be put together. If the shared folder is still syncing the takes, wait a moment and try again.";
  $effect(() => {
    if (format !== 'voice' || clips || failed) return;
    readClips(dir, script, RATE).then((c) => (clips = c), (e) => (problem(VOICE_FAILED, 'putting the voice-over together', e), (failed = true)));
  });
  const reads = $derived(rows(script).map((row) => (countWords(row.dialogue) / speaking.wpm) * 60));
  const lined = $derived(clips ? lineUp(clips, reads, RATE, voiceHow.silence) : []);
  const gap = $derived(voiceHow.gap ? GAP : 0);
  // The joined file is made a slice at a time (PF-6), again when the settings change; Save waits for it.
  let file = $state<Blob | null>(null);
  $effect(() => {
    const clipsNow = lined;
    const gapNow = gap;
    file = null;
    if (!clips?.length) return;
    let stale = false;
    wavFile(clipsNow, RATE, gapNow, () => stale).then((made) => {
      if (!stale) file = made;
    });
    return () => (stale = true);
  });
  let sound = $state('');
  $effect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    sound = url;
    return () => URL.revokeObjectURL(url);
  });
  // The .mp3 (#237) is encoded from the same clips in a worker; the preview plays the WAV meanwhile, and Save waits.
  let mp3 = $state<Blob | null>(null);
  $effect(() => {
    const clipsNow = lined;
    const gapNow = gap;
    mp3 = null;
    if (!voiceHow.mp3 || !clipsNow.length) return;
    let stale = false;
    mp3File(clipsNow, RATE, gapNow, () => stale).then(
      (made) => !stale && (mp3 = made),
      (e) => !stale && (problem(VOICE_FAILED, 'making the voice-over .mp3', e), (failed = true)),
    );
    return () => (stale = true);
  });
  const saved = $derived(voiceHow.mp3 ? mp3 : file);
  const missing = $derived(clips ? rows(script).length - clips.length : 0);

  // Resolve / Premiere (EX-19): the storyboard timeline's layout, with each row's take length (read once) or read time,
  // as the timeline under the script times it.
  let takes = $state<Record<string, Take> | null>(null);
  $effect(() => {
    if ((format === 'edit' || format === 'video') && !takes) readTakes(dir).then((t) => (takes = t));
  });
  const laid = $derived(takes ? layout(script, rowLength(takes, speaking.wpm)) : null);
  const edited = $derived(laid ? editPlan(script, laid, edit) : null);
  let making = $state(false);
  let leftOut = $state<string[]>([]);
  const EDIT_FAILED = "The .zip couldn't be made. If the shared folder is still syncing, wait a moment and try again.";
  async function saveEdit() {
    if (!edited || making || !editReady) return;
    making = true;
    leftOut = [];
    try {
      const made = await editZip(dir, edited, title, name, $state.snapshot(edit));
      leftOut = made.missing;
      download(`${name}.zip`, made.zip);
    } catch (e) {
      problem(EDIT_FAILED, 'making the Resolve / Premiere zip', e);
    } finally {
      making = false;
    }
  }

  // The video (SB-3): the same plan, collages as one picture, no markers; rows with no take silent or left out.
  const shape = $derived(shapeOf(script.front));
  const videoLaid = $derived.by(() => {
    if (!takes) return null;
    const length = rowLength(takes, speaking.wpm);
    return layout(script, video.skip ? (row) => (takes![row.id] ? length(row) : { seconds: 0, take: false }) : length);
  });
  const videoPlan = $derived(videoLaid ? editPlan(script, videoLaid, { ...EDIT, stacked: false, markers: false, captions: video.captions }, video.find ? (row) => stillToFind(row, lostFiles) : undefined) : null);
  const VIDEO_SIZES = [{ id: '720', name: '720p' }, { id: '1080', name: '1080p' }];
  // Save stays greyed while a Custom box (#217) holds something that isn't a size or a rate.
  const editReady = $derived(!!editFrame(edit) && !!editFps(edit));
  const videoReady = $derived(!!videoFrame(video, shape) && !!videoFps(video));
  let progress = $state<number | null>(null);
  let stop = false;
  let made = $state<{ url: string; mp4: boolean } | null>(null);
  let videoMissing = $state<string[]>([]);
  const VIDEO_FAILED = "The video couldn't be made. If the shared folder is still syncing, wait a moment and try again.";
  async function saveVideo() {
    if (!videoPlan || progress !== null || !videoReady) return;
    progress = 0;
    stop = false;
    videoMissing = [];
    try {
      const out = await makeVideo(dir, videoPlan, $state.snapshot(video), shape, (done) => (progress = done), () => stop);
      if (out) {
        if (made) URL.revokeObjectURL(made.url);
        made = { url: URL.createObjectURL(out.video), mp4: out.mp4 };
        videoMissing = out.missing;
        download(`${name}.${out.mp4 ? 'mp4' : 'webm'}`, out.video);
      }
    } catch (e) {
      problem(VIDEO_FAILED, 'making the video', e);
    } finally {
      progress = null;
    }
  }
  $effect(() => () => {
    if (made) URL.revokeObjectURL(made.url);
  });

  function save() {
    if (format === 'video') return saveVideo();
    if (format === 'edit') return saveEdit();
    if (format === 'print') return onPrint($state.snapshot(printing));
    if (format === 'fountain') return download(`${name}.fountain`, fountainText);
    if (format === 'fdx') return download(`${name}.fdx`, toFdx(script, title, stand, date, fdx, creditsShown));
    if (saved) download(`${name} voice-over.${voiceHow.mp3 ? 'mp3' : 'wav'}`, saved);
  }

  function download(fileName: string, data: string | Blob) {
    const url = URL.createObjectURL(typeof data === 'string' ? new Blob([data], { type: 'text/plain;charset=utf-8' }) : data);
    Object.assign(document.createElement('a'), { href: url, download: fileName }).click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // Who speaks, for the export card (#221): the narrator first (rows with no speaker), then each speaker in the credits'
  // order, then any name a row has that the credits no longer do; each with its rows and their read time.
  const cast = $derived.by(() => {
    const order = ['', ...speakers(script.front)];
    const by = new Map<string, { who: string; rows: number; seconds: number }>();
    for (const row of rows(script)) {
      if (!by.has(row.speaker)) by.set(row.speaker, { who: row.speaker, rows: 0, seconds: 0 });
      const c = by.get(row.speaker)!;
      c.rows++;
      c.seconds += (countWords(row.dialogue) / speaking.wpm) * 60;
    }
    const rank = (who: string) => (order.includes(who) ? order.indexOf(who) : order.length);
    return [...by.values()].sort((a, b) => rank(a.who) - rank(b.who));
  });

  function speaker(how: Screenplay, value: string) {
    how.speaker = value;
  }
</script>

<svelte:window bind:innerHeight={windowHeight} onkeydown={(e) => e.key === 'Escape' && !(e.target as HTMLElement).closest?.('input') && onBack()} />

{#snippet look(how: Screenplay, notes: boolean)}
  <!-- Roughly how a screenplay app shows the file. Fountain's [[notes]] and sections are hidden there; Final Draft
       shows its General paragraphs. -->
  <div class="screenplay">
    {#each script.blocks as block, i (block)}
      {#if block.type === 'section'}
        {#if how.scenes}<p class="scene" data-hide>{block.title.toUpperCase()}</p>{:else if notes}<p data-hide>{block.title}</p>{/if}
      {:else}
        {@const about = [how.numbers && { app: `Row ${numbers[i]}` }, block.note.trim() && { hide: block.note.trim() }, how.files && block.files.length && { app: 'Files: ', hide: block.files.join(', ') }].filter((a) => !!a)}
        {#if notes && about.length}<p class="general">{#each about as a, k (k)}{k ? ' · ' : ''}{a.app ?? ''}{#if a.hide}<span data-hide>{a.hide}</span>{/if}{/each}</p>{/if}
        {#if block.onScreen.trim()}<p class="action" data-hide>{@html toHtml(block.onScreen.trim())}</p>{/if}
        {#if block.dialogue.trim()}
          <p class="speaker">{#if block.speaker}<span data-hide>{speakerName(block.speaker)}</span>{:else}{speakerName(how.speaker)}{/if}</p>
          <p class="dialogue" data-hide>{@html toHtml(block.dialogue.trim())}</p>
        {/if}
      {/if}
    {/each}
  </div>
{/snippet}

<header>
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="#/"><span data-hide>{folder}</span></a>
    <span aria-hidden="true">/</span>
    <button class="title" onclick={onBack}><span data-hide>{title}</span></button>
    <span aria-hidden="true">/</span>
    <span class="here">Export</span>
  </nav>
  <button class="outline" onclick={onBack}>Back to the script</button>
  <HelpMenu tone="dim" />
</header>

<div class="export">
  <nav class="formats" aria-label="Export as">
    <span class="group">Export as</span>
    {#each FORMATS as f (f.id)}
      <button aria-pressed={format === f.id} onclick={() => (format = f.id)}>{f.name}</button>
    {/each}
  </nav>

  <section class="preview" aria-label="Preview">
    {#if format === 'print'}
      <p class="caption">As it will print, {printing.landscape ? 'landscape' : 'portrait'}{printing.lines ? ', with the Notes lines at the foot of every page' : ''}. Print… opens the browser's print window, where "Save as PDF" makes the PDF.</p>
      <div bind:clientWidth={boxWidth}>
        <!-- A page drawn at the paper's size and shrunk to fit: the rows scroll in what the Notes lines leave of it. -->
        <div class="page" style:width="{paper.w * fit}px" style:height="{paper.h * fit}px">
          <div class="paper" style:width="{paper.w}px" style:height="{paper.h}px" style:zoom={fit}>
            <Print {script} {dir} {title} {version} column={printing.column} lines={printing.lines} scale={printing.scale / 100} hidden={printing.hidden} landscape={printing.landscape} credits={creditsShown} onScreen />
          </div>
        </div>
      </div>
    {:else if format === 'fountain'}
      <p class="caption"><span data-hide>{name}</span>.fountain</p>
      <div class="pair">
        <pre class="file" data-hide>{fountainText}</pre>
        {@render look(fountain, false)}
      </div>
      <p class="caption">Left: the file as saved. Right: roughly how a screenplay app (Trelby, Highland) shows it.</p>
    {:else if format === 'fdx'}
      <p class="caption"><span data-hide>{name}</span>.fdx</p>
      {@render look(fdx, true)}
      <p class="caption">Roughly how Final Draft shows it. The file itself is XML, so it isn't shown.</p>
    {:else if format === 'edit'}
      {#if edited}
        <EditPreview plan={edited} how={edit} {name} />
        {#if leftOut.length}<p class="message left-out" role="alert">Saved, but {leftOut.length === 1 ? 'one file' : `${leftOut.length} files`} couldn't be read and {leftOut.length === 1 ? 'is' : 'are'} left out (the editor sees {leftOut.length === 1 ? 'it' : 'them'} offline): {leftOut.join(', ')}.</p>{/if}
      {:else}
        <p class="message">Reading the takes…</p>
      {/if}
    {:else if format === 'video'}
      {#if videoPlan}
        <VideoPreview plan={videoPlan} {dir} {shape} how={video} {name} {made} {progress} onStop={() => (stop = true)} />
        {#if made && !made.mp4}<p class="message left-out">Saved as WebM: this browser can't make MP4 here. It plays in Chrome, Edge and VLC; YouTube takes it too.</p>{/if}
        {#if videoMissing.length}<p class="message left-out" role="alert">Saved, but {videoMissing.length === 1 ? 'one file' : `${videoMissing.length} files`} couldn't be read and {videoMissing.length === 1 ? 'shows' : 'show'} as a grey card with {videoMissing.length === 1 ? 'its' : 'their'} name: {videoMissing.join(', ')}.</p>{/if}
      {:else}
        <p class="message">Reading the takes…</p>
      {/if}
    {:else}
      <p class="caption"><span data-hide>{name}</span> voice-over.{voiceHow.mp3 ? `mp3 · 48 kHz mono · ${KBPS} kbps` : 'wav · 48 kHz mono'}{saved ? ` · ${sizeText(saved.size)}` : ''}</p>
      {#if failed}
        <p class="message" role="alert">{VOICE_FAILED}<CopyDetails message={VOICE_FAILED} /></p>
      {:else if !clips}
        <p class="message">Putting the takes together…</p>
      {:else if !clips.length}
        <p class="message" role="alert">No voice-over has been recorded yet. Record a take with the mic beside a row first.</p>
      {:else}
        <VoicePreview rows={rows(script)} {lined} {gap} rate={RATE} {sound} />
        <p class="caption">{clips.length} of {rows(script).length} rows have a take{missing ? `; the other ${missing === 1 ? 'is' : `${missing} are`} ${voiceHow.silence ? 'silent for their read time' : 'left out'}` : ''}. Click a row to hear it.</p>
      {/if}
    {/if}
  </section>

  <aside aria-label="Settings">
    <div class="card">
      <h2>Settings</h2>
      {#if format === 'print'}
        <fieldset>
          <legend>Page</legend>
          <div class="turns">
            <label><input type="radio" name="page" checked={!printing.landscape} onchange={() => (printing.landscape = false)} />
              <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true"><rect x="1" y="1" width="12" height="16" rx="1.5" /></svg> Portrait</label>
            <label><input type="radio" name="page" checked={printing.landscape} onchange={() => (printing.landscape = true)} />
              <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true"><rect x="1" y="1" width="16" height="12" rx="1.5" /></svg> Landscape</label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Columns to print</legend>
          {#each COLUMNS as c (c.id)}
            {@const on = !printing.hidden.includes(c.id)}
            <label><input type="checkbox" checked={on} disabled={on && printing.hidden.length === COLUMNS.length - 1} onchange={() => showColumn(c.id, !on)} /> {c.name}</label>
          {/each}
          {#if printing.hidden.length === COLUMNS.length - 1}<p class="kept">At least one column prints.</p>{/if}
        </fieldset>
        <label><input type="checkbox" bind:checked={printing.column} /> Notes column on each row</label>
        <label><input type="checkbox" checked={printing.lines > 0} onchange={(e) => setLines(e.currentTarget.checked)} /> Notes lines on every page</label>
        {#if printing.lines}
          <div class="count">Lines
            <button type="button" aria-label="Fewer lines" disabled={lineCount <= 2} onclick={() => setLines(true, lineCount - 1)}>−</button>
            <span aria-live="polite">{lineCount}</span>
            <button type="button" aria-label="More lines" disabled={lineCount >= 8} onclick={() => setLines(true, lineCount + 1)}>+</button>
          </div>
        {/if}
        <label class="size">Text size <input type="range" min="60" max="140" step="5" bind:value={printing.scale} /> <span>{printing.scale}%</span></label>
      {:else if format === 'fountain' || format === 'fdx'}
        {@const how = format === 'fountain' ? fountain : fdx}
        <label class="text">{cast.length > 1 ? "Narrator's name" : 'Speaker name'} <input type="text" value={how.speaker} oninput={(e) => speaker(how, e.currentTarget.value)} /></label>
        {#if cast.length > 1}
          <!-- #221 (board 88): each speaker's rows and read time; rows with no speaker are the narrator's. -->
          <ul class="cast" aria-label="Speakers">{#each cast as c (c.who)}<li><b>{#if c.who}<span data-hide>{c.who}</span>{:else}Narrator ({speakerName(how.speaker)}){/if}</b> {c.rows} {c.rows === 1 ? 'row' : 'rows'}, {clock(c.seconds)}</li>{/each}</ul>
        {/if}
        <label><input type="checkbox" bind:checked={how.scenes} /> Sections as scene headings</label>
        {#if format === 'fountain'}
          <label><input type="checkbox" bind:checked={fountain.numbers} /> Row numbers as notes</label>
          <label><input type="checkbox" bind:checked={fountain.files} /> Files as notes</label>
        {:else}
          <label><input type="checkbox" checked={fdx.numbers && fdx.files} onchange={(e) => (fdx.numbers = fdx.files = e.currentTarget.checked)} /> Row numbers and files</label>
        {/if}
      {:else if format === 'edit'}
        <FrameChoices bind:how={edit} sizes={SIZES} rates={RATES} group="edit" whole />
        <fieldset class="plain">
          <legend>Collages</legend>
          <label><input type="radio" name="collage" checked={!edit.stacked} onchange={() => (edit.stacked = false)} /> One picture, side by side</label>
          <label><input type="radio" name="collage" checked={edit.stacked} onchange={() => (edit.stacked = true)} /> Each picture on its own track</label>
        </fieldset>
        <label><input type="checkbox" bind:checked={edit.markers} /> A marker on each row, with its dialogue</label>
        <label><input type="checkbox" bind:checked={edit.captions} /> Dialogue as captions (.srt)</label>
      {:else if format === 'video'}
        <FrameChoices bind:how={video} sizes={VIDEO_SIZES} rates={RATES} group="video">
          {#snippet underSize()}
            {#if video.size !== 'custom'}<p class="kept help">{shape === 'upright' ? 'Upright' : 'Wide'}, as set on the timeline at the bottom of Write.</p>{/if}
          {/snippet}
        </FrameChoices>
        <label><input type="checkbox" bind:checked={video.captions} /> Dialogue as captions on the picture</label>
        <fieldset class="plain">
          <legend>Rows with no take</legend>
          <label><input type="radio" name="notake" checked={!video.skip} onchange={() => (video.skip = false)} /> Silent, for their read time</label>
          <label><input type="radio" name="notake" checked={video.skip} onchange={() => (video.skip = true)} /> Left out</label>
        </fieldset>
        <label><input type="checkbox" bind:checked={video.sound} /> Keep videos' own sound, under the voice</label>
        <label><input type="checkbox" bind:checked={video.find} /> Say what's still to find on placeholders</label>
      {:else}
        <fieldset class="plain">
          <legend>File type</legend>
          <label><input type="radio" name="voicetype" checked={voiceHow.mp3} onchange={() => (voiceHow.mp3 = true)} /> .mp3 (about a tenth the size)</label>
          <label><input type="radio" name="voicetype" checked={!voiceHow.mp3} onchange={() => (voiceHow.mp3 = false)} /> .wav (full quality, bigger)</label>
        </fieldset>
        <label><input type="checkbox" bind:checked={voiceHow.gap} /> Half a second between takes</label>
        <label><input type="checkbox" bind:checked={voiceHow.silence} /> Silence for rows with no take</label>
      {/if}
      {#if credits.length && format !== 'voice' && format !== 'edit' && format !== 'video'}
        <label><input type="checkbox" bind:checked={printing.credits} /> {format === 'print' ? 'Credits after the rows' : 'Credits on the title page'}</label>
      {/if}
      <p class="kept">Remembered on this computer for next time.</p>
      <button class="primary" disabled={(format === 'voice' && !saved) || (format === 'edit' && (!edited?.total || making || !editReady)) || (format === 'video' && (!videoPlan?.total || progress !== null || !videoReady))} onclick={save}>{format === 'edit' && making ? 'Making the .zip…' : format === 'video' && progress !== null ? 'Making the video…' : format === 'voice' ? (clips?.length && !saved ? `Making the .${voiceHow.mp3 ? 'mp3' : 'wav'}…` : `Save .${voiceHow.mp3 ? 'mp3' : 'wav'}`) : FORMATS.find((f) => f.id === format)?.action}</button>
      {#if format === 'print'}
        <p class="kept help">If words can't be selected in the PDF, choose "Microsoft Print to PDF" instead of "Adobe PDF".</p>
      {/if}
    </div>
  </aside>
</div>

<style>
  header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; padding: 10px 24px; border-bottom: 1px solid var(--line); }
  .crumbs { display: flex; align-items: center; gap: 6px; flex: 1 1 280px; min-width: 0; font-size: 14px; }
  .crumbs a, .crumbs .title { display: inline-flex; align-items: center; min-height: 44px; padding: 0 4px; border: 0; background: none;
    color: var(--muted); text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .crumbs a:hover, .crumbs .title:hover { color: var(--accent); }
  .crumbs span[aria-hidden] { color: #9a9a9a; }
  .here { font-size: 15px; font-weight: 600; }
  .export { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 24px; max-width: 1400px; margin: 0 auto; padding: 24px 24px 64px; }
  .formats { flex: 0 0 200px; display: flex; flex-direction: column; gap: 2px; padding: 6px; border: 1px solid var(--line); border-radius: 10px; }
  .group { margin: 4px 10px; font-size: 12px; color: var(--muted); }
  .formats button { min-height: 44px; padding: 0 12px; border: 0; border-radius: 6px; background: none; text-align: left; font-size: 14px; color: var(--ink); }
  .formats button:hover { background: #f7f7f7; }
  .formats button[aria-pressed='true'] { background: #f2f2f2; font-weight: 600; }
  .preview { flex: 1 1 520px; min-width: 0; }
  .caption { margin: 0 0 8px; font-size: 13px; color: var(--muted); }
  .preview > * + .caption { margin-top: 8px; }
  .preview .message.left-out { margin-top: 16px; }
  .message { margin: 0; padding: 16px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; }
  .page { box-sizing: content-box; overflow: hidden; background: #fff; border: 1px solid var(--line); box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08); }
  .paper { box-sizing: border-box; padding: 53px 45px 60px; } /* Print's margins: 14, 12 and 16 mm */
  .pair { display: flex; flex-wrap: wrap; gap: 16px; }
  .pair > :global(*) { flex: 1 1 280px; min-width: 0; }
  .file { box-sizing: border-box; margin: 0; max-height: 75vh; overflow: auto; padding: 16px 18px; border: 1px solid var(--line); border-radius: 10px;
    font: 12.5px/1.6 ui-monospace, Menlo, monospace; color: #3d3d3d; white-space: pre-wrap; }
  .screenplay { max-height: 75vh; overflow: auto; box-sizing: border-box; padding: 28px 32px; border: 1px solid var(--line); border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08); font: 12.5px/1.5 'Courier New', Courier, monospace; }
  .screenplay p { margin: 0 0 12px; white-space: pre-wrap; }
  .screenplay .scene { font-weight: 700; }
  .screenplay .general { color: var(--muted); }
  .screenplay .speaker { margin: 0 0 0 37%; }
  .screenplay .dialogue { margin: 0 12% 12px 18%; }
  aside { flex: 0 1 300px; min-width: 260px; }
  .card { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border: 1px solid var(--line); border-radius: 10px; font-size: 14px; }
  h2 { margin: 0 0 2px; font-size: 14px; font-weight: 600; }
  label { display: flex; align-items: center; gap: 8px; min-height: 32px; }
  label.text { flex-direction: column; align-items: stretch; gap: 4px; }
  label.text input { min-height: 40px; padding: 0 10px; border: 1px solid #d6d6d6; border-radius: 6px; font: inherit; }
  .size input { flex: 1; min-width: 0; }
  .turns { display: flex; gap: 8px; }
  .turns label { flex: 1; min-height: 44px; padding: 0 10px; border: 1.5px solid var(--line-strong); border-radius: 8px; cursor: pointer; }
  .turns label:has(input:checked) { border-color: var(--accent); background: #f3f6fd; }
  .turns input { margin: 0; }
  .turns svg { fill: none; stroke: currentColor; stroke-width: 1.5; }
  .count { display: flex; align-items: center; gap: 8px; min-height: 32px; padding-left: 26px; color: var(--muted); }
  .count button { width: 32px; height: 32px; padding: 0; border: 1px solid var(--line-strong); border-radius: 6px; background: var(--ground); color: var(--ink); font-size: 16px; }
  .count button:disabled { color: var(--line-strong); }
  .count span { min-width: 1ch; text-align: center; color: var(--ink); }
  .kept { margin: 2px 0 0; font-size: 12px; color: var(--muted); }
  .cast { margin: 0; padding: 0; list-style: none; font-size: 13px; line-height: 1.7; color: var(--muted); }
  .cast b { font-weight: 600; color: var(--ink); }
  fieldset { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0 0 10px; border: 0; border-bottom: 1px solid var(--line); }
  legend { padding: 0; margin-bottom: 4px; font-size: 12px; color: var(--muted); }
  fieldset.plain { border-bottom: 0; padding-bottom: 0; }
  .primary { min-height: 44px; font-size: 14px; }
  .primary:disabled { opacity: 0.5; cursor: default; }
</style>
