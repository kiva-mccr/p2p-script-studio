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
  import { shownCredits } from '../lib/people';
  import { COLUMNS, readHidden } from '../lib/printcolumns';
  import { keep, recall } from '../lib/remember';
  import { frontValue, rows, type Script } from '../lib/script';
  import { lineUp, readClips, wavFile, type Clip } from '../lib/voiceexport';
  import Print from './Print.svelte';
  import EditPreview from './EditPreview.svelte';
  import { EDIT, RATES, SIZES, plan as editPlan } from '../lib/editxml';
  import { editZip } from '../lib/editmedia';
  import { layout, shapeOf } from '../lib/timeline';
  import VideoPreview from './VideoPreview.svelte';
  import { VIDEO, makeVideo } from '../lib/video';
  import { readTakes, rowLength, type Take } from '../lib/voice.svelte';

  // version: "v3", or "" for a draft (Editor's `version()`, which saved what was waiting).
  let { script, dir, folder, title, version, start, onPrint, onBack }: {
    script: Script; dir: FileSystemDirectoryHandle; folder: string; title: string; version: string; start: Format;
    onPrint: (choices: PrintChoices) => void; onBack: () => void;
  } = $props();

  const FORMATS: { id: Format; name: string; action: string }[] = [
    { id: 'print', name: 'Print / PDF', action: 'Print…' },
    { id: 'fountain', name: 'Fountain (.fountain)', action: 'Save .fountain' },
    { id: 'fdx', name: 'Final Draft (.fdx)', action: 'Save .fdx' },
    { id: 'voice', name: 'Voice-over (.wav)', action: 'Save .wav' },
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
  let voiceHow = $state(load('export-voice', { gap: false, silence: false }));
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
  // The preview's page is drawn at the printed width (a Letter page less Print's margins, in CSS px) and shrunk to fit.
  let pageWidth = $state(0);
  const sheetWidth = $derived(printing.landscape ? 965 : 725);
  const fit = $derived(pageWidth ? Math.min(1, (pageWidth - 64) / sheetWidth) : 1);
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

  // The title page's line, as print and the exports always had it: "v3 · Approved", or "Draft".
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
  let audio = $state<HTMLAudioElement>();
  $effect(() => {
    if (format !== 'voice' || clips || failed) return;
    readClips(dir, script, RATE).then((c) => (clips = c), (e) => (problem(VOICE_FAILED, 'putting the voice-over together', e), (failed = true)));
  });
  const reads = $derived(rows(script).map((row) => (countWords(row.dialogue) / speaking.wpm) * 60));
  const lined = $derived(clips ? lineUp(clips, reads, RATE, voiceHow.silence) : []);
  const gap = $derived(voiceHow.gap ? GAP : 0);
  // Where each lined-up row starts in the joined file, in seconds.
  const starts = $derived.by(() => {
    const out: number[] = [];
    let at = 0;
    for (const clip of lined) {
      out.push(at);
      at += clip.samples.length / RATE + gap;
    }
    return out;
  });
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
  const missing = $derived(clips ? rows(script).length - clips.length : 0);

  function from(i: number) {
    if (!audio) return;
    audio.currentTime = starts[i];
    audio.play().catch(() => {});
  }

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
    if (!edited || making) return;
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
  const videoPlan = $derived(videoLaid ? editPlan(script, videoLaid, { ...EDIT, stacked: false, markers: false, captions: video.captions }) : null);
  let progress = $state<number | null>(null);
  let stop = false;
  let made = $state<{ url: string; mp4: boolean } | null>(null);
  let videoMissing = $state<string[]>([]);
  const VIDEO_FAILED = "The video couldn't be made. If the shared folder is still syncing, wait a moment and try again.";
  async function saveVideo() {
    if (!videoPlan || progress !== null) return;
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
    if (file) download(`${name} voice-over.wav`, file);
  }

  function download(fileName: string, data: string | Blob) {
    const url = URL.createObjectURL(typeof data === 'string' ? new Blob([data], { type: 'text/plain;charset=utf-8' }) : data);
    Object.assign(document.createElement('a'), { href: url, download: fileName }).click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function speaker(how: Screenplay, value: string) {
    how.speaker = value;
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && !(e.target as HTMLElement).closest?.('input') && onBack()} />

{#snippet look(how: Screenplay, notes: boolean)}
  <!-- Roughly how a screenplay app shows the file. Fountain's [[notes]] and sections are hidden there; Final Draft
       shows its General paragraphs. -->
  <div class="screenplay">
    {#each script.blocks as block, i (block)}
      {#if block.type === 'section'}
        {#if how.scenes}<p class="scene">{block.title.toUpperCase()}</p>{:else if notes}<p>{block.title}</p>{/if}
      {:else}
        {@const about = [how.numbers && `Row ${numbers[i]}`, block.note.trim(), how.files && block.files.length && `Files: ${block.files.join(', ')}`].filter(Boolean)}
        {#if notes && about.length}<p class="general">{about.join(' · ')}</p>{/if}
        {#if block.onScreen.trim()}<p class="action">{@html toHtml(block.onScreen.trim())}</p>{/if}
        {#if block.dialogue.trim()}
          <p class="speaker">{speakerName(how.speaker)}</p>
          <p class="dialogue">{@html toHtml(block.dialogue.trim())}</p>
        {/if}
      {/if}
    {/each}
  </div>
{/snippet}

<header>
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="#/">{folder}</a>
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
      <div class="page" class:landscape={printing.landscape} bind:clientWidth={pageWidth}>
        <!-- Drawn at the printed width and shrunk to fit, so the columns look as they will on paper. -->
        <div style:width="{sheetWidth}px" style:zoom={fit}>
          <Print {script} {dir} {title} {version} column={printing.column} lines={printing.lines} scale={printing.scale / 100} hidden={printing.hidden} landscape={printing.landscape} credits={creditsShown} onScreen />
        </div>
      </div>
    {:else if format === 'fountain'}
      <p class="caption">{name}.fountain</p>
      <div class="pair">
        <pre class="file">{fountainText}</pre>
        {@render look(fountain, false)}
      </div>
      <p class="caption">Left: the file as saved. Right: roughly how a screenplay app (Trelby, Highland) shows it.</p>
    {:else if format === 'fdx'}
      <p class="caption">{name}.fdx</p>
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
      <p class="caption">{name} voice-over.wav · 48 kHz mono</p>
      {#if failed}
        <p class="message" role="alert">{VOICE_FAILED}<CopyDetails message={VOICE_FAILED} /></p>
      {:else if !clips}
        <p class="message">Putting the takes together…</p>
      {:else if !clips.length}
        <p class="message" role="alert">No voice-over has been recorded yet. Record a take with the mic beside a row first.</p>
      {:else}
        <div class="voice">
          <audio bind:this={audio} src={sound} controls></audio>
          <ol>
            {#each rows(script) as row, r (row.id)}
              {@const i = lined.findIndex((c) => c.row === r + 1)}
              {#if i > 0 && gap}<li class="pause"><span></span><span>pause</span><span></span><span>{gap}s</span></li>{/if}
              <li>
                <span class="num">{r + 1}</span>
                {#if i >= 0}
                  <button class="row" class:silent={lined[i].silent} onclick={() => from(i)}><span data-hide>{row.dialogue.trim() || '(no dialogue)'}</span></button>
                  <span class="missing">{lined[i].silent ? 'no take yet, silence' : ''}</span>
                  <span>{clock(lined[i].samples.length / RATE)}</span>
                {:else}
                  <span class="left">{row.dialogue.trim() || '(no dialogue)'}</span>
                  <span class="missing">no take yet, left out</span>
                  <span class="left">–</span>
                {/if}
              </li>
            {/each}
          </ol>
        </div>
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
        <label class="text">Speaker name <input type="text" value={how.speaker} oninput={(e) => speaker(how, e.currentTarget.value)} /></label>
        <label><input type="checkbox" bind:checked={how.scenes} /> Sections as scene headings</label>
        {#if format === 'fountain'}
          <label><input type="checkbox" bind:checked={fountain.numbers} /> Row numbers as notes</label>
          <label><input type="checkbox" bind:checked={fountain.files} /> Files as notes</label>
        {:else}
          <label><input type="checkbox" checked={fdx.numbers && fdx.files} onchange={(e) => (fdx.numbers = fdx.files = e.currentTarget.checked)} /> Row numbers and files</label>
        {/if}
      {:else if format === 'edit'}
        <label class="text">Frame size
          <select bind:value={edit.size}>{#each SIZES as s (s.id)}<option value={s.id}>{s.name}</option>{/each}</select>
        </label>
        <fieldset class="plain">
          <legend>Frames per second</legend>
          <div class="rates">
            {#each RATES as r (r)}<label><input type="radio" name="fps" checked={edit.fps === r} onchange={() => (edit.fps = r)} /> {r}</label>{/each}
          </div>
        </fieldset>
        <fieldset class="plain">
          <legend>Collages</legend>
          <label><input type="radio" name="collage" checked={!edit.stacked} onchange={() => (edit.stacked = false)} /> One picture, side by side</label>
          <label><input type="radio" name="collage" checked={edit.stacked} onchange={() => (edit.stacked = true)} /> Each picture on its own track</label>
        </fieldset>
        <label><input type="checkbox" bind:checked={edit.markers} /> A marker on each row, with its dialogue</label>
        <label><input type="checkbox" bind:checked={edit.captions} /> Dialogue as captions (.srt)</label>
      {:else if format === 'video'}
        <fieldset class="plain">
          <legend>Frame size</legend>
          <div class="rates">
            <label><input type="radio" name="vsize" checked={video.size === '720'} onchange={() => (video.size = '720')} /> 720p</label>
            <label><input type="radio" name="vsize" checked={video.size === '1080'} onchange={() => (video.size = '1080')} /> 1080p</label>
          </div>
          <p class="kept help">{shape === 'upright' ? 'Upright' : 'Wide'}, as set on the timeline at the bottom of Write.</p>
        </fieldset>
        <label><input type="checkbox" bind:checked={video.captions} /> Dialogue as captions on the picture</label>
        <fieldset class="plain">
          <legend>Rows with no take</legend>
          <label><input type="radio" name="notake" checked={!video.skip} onchange={() => (video.skip = false)} /> Silent, for their read time</label>
          <label><input type="radio" name="notake" checked={video.skip} onchange={() => (video.skip = true)} /> Left out</label>
        </fieldset>
        <label><input type="checkbox" bind:checked={video.sound} /> Keep videos' own sound, under the voice</label>
      {:else}
        <label><input type="checkbox" bind:checked={voiceHow.gap} /> Half a second between takes</label>
        <label><input type="checkbox" bind:checked={voiceHow.silence} /> Silence for rows with no take</label>
      {/if}
      {#if credits.length && format !== 'voice' && format !== 'edit' && format !== 'video'}
        <label><input type="checkbox" bind:checked={printing.credits} /> {format === 'print' ? 'Credits after the rows' : 'Credits on the title page'}</label>
      {/if}
      <p class="kept">Remembered on this computer for next time.</p>
      <button class="primary" disabled={(format === 'voice' && !file) || (format === 'edit' && (!edited?.total || making)) || (format === 'video' && (!videoPlan?.total || progress !== null))} onclick={save}>{format === 'edit' && making ? 'Making the .zip…' : format === 'video' && progress !== null ? 'Making the video…' : FORMATS.find((f) => f.id === format)?.action}</button>
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
  .page { box-sizing: border-box; max-width: 790px; max-height: 75vh; overflow: auto; padding: 32px; background: #fff; border: 1px solid var(--line); box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08); }
  .page.landscape { max-width: 1030px; aspect-ratio: 11 / 8.5; }
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
  .voice { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .voice audio { display: block; box-sizing: border-box; width: 100%; padding: 12px 16px; border-bottom: 1px solid var(--line); }
  ol { margin: 0; padding: 8px 16px; list-style: none; font-size: 13px; }
  li { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto 48px; gap: 12px; align-items: center; }
  li > :last-child { text-align: right; }
  .num { color: var(--muted); }
  .row { min-height: 36px; padding: 0; border: 0; background: none; text-align: left; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row:hover { color: var(--accent); }
  .row.silent, .left { color: #8a5300; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .left { min-height: 36px; line-height: 36px; }
  .missing { font-size: 12px; color: #8a5300; }
  .pause { font-size: 12px; color: #8a8a8a; min-height: 20px; }
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
  fieldset { display: flex; flex-direction: column; gap: 2px; margin: 0; padding: 0 0 10px; border: 0; border-bottom: 1px solid var(--line); }
  legend { padding: 0; margin-bottom: 4px; font-size: 12px; color: var(--muted); }
  label.text select { min-height: 40px; padding: 0 8px; border: 1px solid #d6d6d6; border-radius: 6px; background: var(--ground); font: inherit; }
  fieldset.plain { border-bottom: 0; padding-bottom: 0; }
  .rates { display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .primary { min-height: 44px; font-size: 14px; }
  .primary:disabled { opacity: 0.5; cursor: default; }
</style>
