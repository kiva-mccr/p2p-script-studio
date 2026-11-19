# P2P Script Studio: project notes for Claude Code

A free, minimalist web app for writing, reviewing and producing educational video scripts. Scripts are
three-column Markdown (dialogue, on screen, images and files) kept in a shared OneDrive folder that is synced to
each person's computer. The app runs from GitHub Pages and opens that folder through the browser (Chrome and Edge,
desktop only). No server, no database, no sign-in. The roadmap (steps, status, decisions) is ROADMAP.md: tick `[x]`
there as steps land and keep the IDs stable.

## Run and test
- Svelte 5 + TypeScript, built with Vite. Install: `npm ci`. Run: `npm run dev`.
- Checks: `npm run check` (types), `npm test` (Vitest, `tests/unit/`), `npm run e2e` (Playwright, `tests/e2e/`,
  builds and serves the app itself). Playwright is pinned to 1.63.0 to match this container's Chromium.
- svelte-check needs TypeScript 6 (TypeScript 7 is not supported by it yet).
- `.npmrc` skips onnxruntime-node's CUDA download (a dependency of transformers.js): its GPU binary went 404 on
  GitHub and broke `npm ci` in CI and here (2026-11-18). The app never uses it (it runs in the browser).
- The app is at https://p2p-script-studio.kivamccr.xyz/ (custom domain set in repo Settings > Pages; DNS is at
  Cloudflare since 2026-11-18, a proxied CNAME to kiva-mccr.github.io; Cloudflare adds the security headers, SE-4,
  lib/headers.md; the domain is still registered at Hostinger, whose site and email are DNS only). GitHub redirects the old kiva-mccr.github.io/Internal-Script-Studio/
  there. vite.config.ts `base` is `./`, so a build works at either address. `deploy.yml` publishes every push to main
  that changes code; Pages' source must be "GitHub Actions" (no CNAME file needed with Actions).
- Pushes to main that change only `.md` files or docs skip the workflows; pull requests always run Tests, because
  the main ruleset requires the `test` check (merge only through a PR, no force-push or deletion).
- For a text-only change, run only the tests that cover it.

## Conventions worth keeping
- Minimalist above all (the user's words: "minimalist as hell"). See the guardrails in ROADMAP.md.
- Scripts and their assets never go in this repo: it is public, and the content lives in OneDrive. The one
  exception is the made-up example in docs/example/.
- The script format is docs/script-format.md, and `.studio/` (history, comments, editing) is docs/studio-folder.md:
  read the one you touch first. Files in `.studio/` are written once and never edited (OneDrive sync).
- Every code file gets a short note beside it (`name.md`): purpose, then "Rules and pitfalls". Read it before
  editing the file; add the rule or the bug there when you fix one.
- Every new behaviour gets a test.
- Keep screen files small: saving and History are `lib/saving.svelte.ts`, one row of Write is `WriteRow.svelte`;
  a new screen, panel or chunk of logic gets its own file rather than growing `Editor.svelte` or `Write.svelte`.

## Before handing a round over
Run through `.claude/CHECKLIST.md`. Keep README.md current in the same commit as the change.

## How the user likes to work
- Go step by step through the roadmap; do not build unapproved steps.
- One thread per feature (the user's way of working): mock-ups for a round of features are done up front, then the
  features are built one after another, each finished and merged before the next, so nothing is left half built
  when tokens run out.
- Show mock-ups of a design and agree the look and the open choices before building it.
- Finish a step with: tests passing, roadmap ticked, README updated, a short summary that says plainly what was
  verified and what was only simulated.
- Every prompt, before finishing: tidy what was touched (dead code, stale comments, debug lines, scratch files).
- Last thing on every prompt: update this file if anything important changed (Next, a rule learnt, Known gaps,
  commands, conventions or preferences), then commit and push with the rest. A finished step goes in the roadmap,
  not here. Keep this file short to save tokens.
- Save tokens: search ROADMAP.md by step ID instead of reading it whole; read a file's note before the file.
- Ask before changing a decision already settled (Decisions in ROADMAP.md).
- No browser dialogs (confirm, alert, validation bubbles): messages and checks are shown in the page.
- A new grey line that explains how a feature works gets `class="help"`, so Hide help text (AP-43) hides it
  (rules in `src/lib/helptext.md`).
- Merging: the user lets Claude merge its own PRs once checks pass, then check the live site after the deploy.
  Turn on auto-merge (merge method) right after opening a PR, so GitHub merges it the moment `test` passes; nothing
  wakes a thread when CI ends, and waiting on a reminder left green PRs unmerged. Then check the deploy and live site.

## Status
- Next: a round of 10 picked by the user, mock-ups on boards 21 to 29, built one at a time in this order: AP-12 (done),
  AP-9 (done), AP-24 (done), RV-7 (done), EX-12 (done), RV-11 (done), RV-8 (done), EX-9 (done), RV-4 (done), AS-1 (done). Since then, asked by the user: AP-28 (done), AU-5 (done), AU-7 (done), AU-8 (done), AU-9 (done), AP-30 (done), AP-29 (done), EX-16 (done), AP-19 (done), EX-15 (done), RV-13 (done). Then, the user's ranked picks (2026-11-12), mock-ups first: RV-14 (done), AP-32 (done), RV-15 (done), AP-33 (done). Then, added by the user (2026-11-13), in this order: RV-9 (done), RV-6 (done), RV-12 (done), EX-18 (done), AP-31 (done).
- Done 2026-11-13: flaky tests, the screen split, HI-3, AP-34, RV-17, RV-18, RV-20 (AP-36 shelved by the user).
- FX-1, then FX-2 (saving with each person's own change files, the user's design) went ahead of the round.
- Now (the user's ranking, 2026-11-13), mock-ups first, built in this order: RV-19 (done), RV-22 (done), RV-16 (done), AP-38 (done), RV-21 (done),
  AP-39 (done), AP-42 (done), then AP-40 (done), AP-41 (done), RV-23 (done), then AP-37 (done). The user is
  running the real-world checks with the field test checklist:
  https://claude.ai/artifact/FT4p8XLBVTSrEQMow71NDb.
- Queue (the user's order, 2026-11-14), mock-ups first, built one at a time: AP-44 (shortcuts, done), AP-43 (hide help
  text, done), then SB-1 (storyboard timeline, done 2026-11-14), then AP-47 (the tour and the example catch up, done). SB-2 (unpin the timeline, the user, 2026-11-15, done). SB-3 (the timeline as a video, the user, 2026-11-15, done). AP-48 (feedback mode, the user, 2026-11-15, done). SB-4 (the timeline as a drawer at the bottom, replacing SB-2's Unpin and Hide, the user, 2026-11-15, done). SB-6 (which side of the word a cut falls on, board 78, the user, 2026-11-15, done). SB-5 (the drawer opens on a push past the bottom; Feedback, GitHub and the version in a ? menu, the user, 2026-11-15, done). SB-7 (the tour opens the drawer for its timeline step, the user, 2026-11-16, done). SB-8 (cuts timed from the take by a speech model, the user's pick B, 2026-11-16, done). AP-49 (feedback reaches menus: hold Shift to use the page, the user, 2026-11-16, done).
  Then (asked by the user, 2026-11-14): AP-15 (templates, done), then EX-19 (export to Resolve and Premiere, done).
  Then the speed check's fixes, one thread each (the user, 2026-11-14), before and after measured with perf/ in the
  project files: PF-1 (the 5 s check reads only what's new, done), PF-2 (History by name, done), PF-3 (the list reads
  History only back to the latest send, done), PF-4 (History places comments only for the versions shown, done),
  PF-5 (typing redoes only the comment marks it changed, done), PF-6 (the voice-over preview made in slices, done),
  PF-7 (leaving a script frees its memory, done).
  Then less network drive traffic (all of PF-8 to PF-18 queued by the user, 2026-11-15; nothing visible, so no mock-ups),
  one thread each, measured before and after with perf/ (perf/pf-ideas/probe.js counts calls by folder), by impact
  (the user's order): PF-15 (one news folder, done), PF-14 (no checks while away, done), PF-8 (quieter check, done), PF-16 (fast only
  with others, done), PF-9 (comments remembered, done), PF-10 (reads at once, done early, asked by the coordinator), PF-13 (History chapters, done), PF-11 (recent History on open, done), PF-12 (summary
  per script, done), PF-18 (slower heartbeat, done), PF-17 (keep folder handles, done).
  When all are done: a report of their effects (the user's ask), before (perf/pf-ideas/probe-out.txt) against after,
  same probe, same made-up folder.
  A UI audit (2026-11-15) added UX-1 to UX-13 to ROADMAP.md; the user wants all, boards 72 to 75 agreed. Built one
  small PR at a time: UX-4 + UX-13 pointer (done), the shared Undo (UX-1, 2, 10, 11, 13, done), UX-7 (done), UX-12, 6, 8, 3 (done; UX-5 dropped for SB-4's drawer), UX-9 (done).
  Then (the user, 2026-11-16): Ctrl+Z for everything: UX-14 (the script's text, done), then UX-15 (takes, flags, done). UX-16 (Undo toast 5 s, gone when you carry on, done).
  Then security (the user, 2026-11-18, issue #267): SE-1 (Content Security Policy, done), SE-4 (headers via
  Cloudflare, done), SE-9 (integrity hashes, done); the rest (SE-2, 3, 6 to 8) are in docs/security.md.
  Then (the user, 2026-11-18, ahead of boards 82 and 83): SE-10, the sealed app to download (done), then SE-5 (speech
  models from the app, and as the sealed file's second download, done). Then the example in the sealed app,
  kept in IndexedDB (the user's pick, 2026-11-19, done).
  Then issue #254 (EX-22, zoom in the Resolve / Premiere preview, board 79, done 2026-11-18).
  Then board 80's issues (the user, 2026-11-18), one PR each: #245, #238, #225, #207 (SB-9 to SB-12, done), #264
  (SB-13, "No picture" as an icon, done); board 81: #249 (RV-24, done), #250 (RV-25, done), #256 (AP-50, done), #253 (AP-51, word count, done), #262 (AP-52, drop files onto a row, done); board 82: #220 (EX-23, pictures on the video export's clips, done), #212 (EX-24, script lines in Assets, done), #233 (RV-26, tick boxes in Review's plan, done); board 83: #202 (AP-53, Feedback in the tour, done), then the rest of 83. Board 84: #242 (RV-27, a reason on a suggestion, done). Board 88: #224 (AP-55, Copy and Open on
  contacts, done). Board 90: #304 (AP-54, paste a picture into a row, done). Board 87: #219, #239, #232 (AP-56, the ? menu everywhere, done). #230 (AP-57, how long in the status, done). Board 85: #209 (AP-58, file names over previews, done).
  The rest (AP-8 …) waits
  for the user's next ranking; "Last" in ROADMAP.md (EX-5, CC-1) waits until everything else is done.
- Mock-ups (one board per design, numbered): https://claude.ai/artifact/2XDZmS7J5NEPZsz91RQMiL (private to the user).

## Rules learnt from earlier steps
- Test Chromium crashes reading a folder handle back from IndexedDB: e2e tests fake it (`tests/e2e/folder.ts`),
  with a real folder handle from the browser's private storage standing in for the picked folder.
- e2e tests run as "Sam": use other names for other people's versions and editing files. Someone else's save is a
  change file (`changeFile` / `writeChange` in `tests/e2e/folder.ts`), not a write to script.md (that's now an
  outside edit). Typing saves after 1.5 s in tests (`save-every`), 30 s for real; script.md comes after, so poll it.
- Checks look inside a script only when `.studio/news/` has a note about it (PF-15). `writeFile` in tests drops one as
  another computer's app would; `{ outside: true }` (Notepad, Explorer) doesn't, and is found only by the full look
  (2 min; `full-every` shortens it). A new writer of script files must call `announce` (lib/news.md). Others' takes
  are looked at every 30 s (PF-8): a test that writes someone else's take sets `takes-every`. Alone in a script, the
  check runs every 30 s (PF-16); tests run it every 5 s (`alone-every` in playwright.config.ts).
- A script with no touch for 2 minutes is away (PF-14, lib/away.md): no checks, no editing file. Tests that wait over
  2 minutes without moving the mouse must expect that; `away-after` shortens it.
- The Undo toast lasts 30 s in e2e tests (`undo-for` in playwright.config.ts), 5 s for real (UX-16), and any key or
  click outside it closes it: click Undo before typing or clicking elsewhere.
- The timeline's drawer starts folded (SB-4): a test that uses the timeline sets `timeline-open` to '1' first
  (timeline.spec's beforeEach), or clicks its bar (/^Timeline/).
- e2e tests start with the example's tour skipped (playwright.config.ts); a feature named in the tour keeps its
  `data-tour` mark, and its step in `lib/tour.ts` changes with it. The example opens on `samsVersion` of
  docs/example's script.md (lib/example.md).
- A file being written shows in a folder listing as "name.crswap" until it closes, and its real name is there, empty
  (or briefly gone), from the start. Tests read a folder's JSON files with `readJsonFiles` (waits for whole files)
  and count them with `expect.poll`, never `listFiles` + `readFile` + `JSON.parse`.
- Flaky tests show up under load: `npx playwright test --repeat-each=6 --workers=8 --trace off` (about 5 minutes)
  before handing over anything that touches saving, History or the folder. Fix the race, never add retries.
- The speech models come from the site (SE-5): pinned in `src/lib/models.lock.json`, fetched only by the deploy
  (`scripts/models.md`); a new model file the workers load must be pinned (`WANTED`) and stay under 100 MB.
- `npm run build` also makes the sealed file (SE-10, lib/sealed.md); a worker made other than with
  `new Worker(new URL('./x.worker.ts', import.meta.url), { type: 'module' })` breaks it.
- No AudioWorklet or other script made in the page (blob:/data:): the policy refuses it, silently in some cases
  (lib/listen.md).
- The built page has a Content Security Policy (SE-1, lib/csp.md). e2e specs import `test` from `./base`, which fails
  a test on any policy refusal; a feature that needs a new source adds the narrowest one in `lib/csp.ts`, with why.

## Known gaps (never seen for real; confirm when the user can)
- The sealed file (SE-10) in real Chrome/Edge on Windows: only test Chromium opened it from disk. Picking a folder
  there (no picker in headless tests), whether it remembers the folder across openings, and the attestation (made only
  in the deploy) are unseen. Its speech workers with a real models zip (SE-5) are unseen; a wrong zip refused in Settings and the example in
  IndexedDB were seen with the file served from the test site (sealed.spec.ts), not opened from disk.
- The team now uses a Windows mapped network drive (SMB), not OneDrive. FX-2's change files, keeper and spinner with
  two real computers there are unseen (no SMB share here; others are simulated by writing change files in tests).
- The editor's saves and the 5 s check for others' saves with real OneDrive sync delays.
- Conflicts and "… is editing" with two real computers (only simulated by writing files in tests).
- Follow my voice (EX-8, EX-12) with real Moonshine, WebGPU and a real microphone: since SE-5 the live site's models
  were seen loading and hearing (empty text) in headless Chromium with its made-up beep microphone, on WebAssembly;
  real speech and WebGPU are unseen. The following itself was tested with a fake. Whisper
  worked on the user's desktop; the user is to check Moonshine's speed and accuracy (fallback: Whisper on WebGPU).
  Didn't follow on a Pixel 8 in Chrome (issue #24, shelved).
- Fountain and Final Draft files opened in a real screenplay program: only the text and the XML were checked.
- Voice-over takes (AU-1) and the joined WAV (EX-11) with a real microphone and real OneDrive: tests fake the
  recording (a WAV); decoding Chrome's real webm takes was never seen here.
- Play the script (AU-2, AU-7, AU-9) with real takes: tests play the fake WAV takes, and nothing was heard here. Whether the
  shown time keeps up with real webm takes is unseen.
- Notes lines on every printed page (EX-15) in real Chrome/Edge printing to paper: only Chromium's PDF was seen here.
- Landscape print (EX-18) in real Chrome/Edge print windows and on paper: only Chromium's PDF (11 × 8.5 in) was seen here.
- Copy for Teams (EX-10) pasted into real Microsoft Teams: only the clipboard's HTML and text were checked here.
- Paste a draft (AP-13) from real Word: tests paste plain text with Windows line ends through the clipboard.
- Remembering the folder across visits (IndexedDB) and the "Welcome back" permission prompt, in real Chrome/Edge.
- Pick the microphone (AU-3, AU-5) with real microphones: tests fake the list and the recording; an unplugged mic and
  which mic real Chrome/Edge mark as default are unseen.
- The planning panel (AP-24) with two real computers: saves at once are only simulated by writing plan.md in tests.
- Files on comments (RV-11) dropped from real Explorer or pasted from a real screenshot tool, and big files over
  real OneDrive: tests pass files through the file input and a made-up paste.
- Files from other scripts (AS-1) over real OneDrive: a file that is only a placeholder ("online only") is unseen.
- The start cue and clean-up (AU-4) with a real voice and mic: the crop and loudness were only tuned on made-up tones,
  and Chrome's noise reduction switch was only seen being asked for.
- File previews (AP-19) of real camera .mp4/.mov, real Word, PDF and TIFF files: tests use made-up small ones.
- Comments in Write (RV-13) with real OneDrive: a send back by someone else is only simulated by writing its History
  entry in tests.
- Changed since you last looked (RV-15) with real OneDrive and two computers: others' versions are only simulated by
  writing History files in tests; computers whose clocks disagree are unseen.
- Try it with an example (AP-33) in real Chrome/Edge: private storage was only seen in test Chromium.
- Credits and contacts (AP-31) with two real computers and real OneDrive: combining credits saved at once is only
  unit-tested; whether screenplay apps show Fountain's "Credits:" title-page key is unseen.
- Comments in History (RV-6) with real OneDrive: versions and comments from others are only simulated by writing
  their files in tests.
- History at scale (HI-3) on real OneDrive with "online only" files: only a made-up 2,000-version script in test
  Chromium was timed; a first visit on a new computer still reads every file.
- The example's tour (AP-34) in real Chrome/Edge at other window sizes: only 1280 × 800 and 1920 × 1080 test Chromium
  were seen. Its takes are a made-up voice (espeak-ng); nothing was heard here.
- Tab counts (RV-21) with two real computers: others' versions and comments are only simulated by writing their
  files in tests.
- Smooth scrolling (AP-39) with real camera photos and .mov files on a real computer: only made-up 4000 × 3000
  JPEGs and 4K webm in headless test Chromium were timed; real GPU raster and the user's screen are unseen.
- The script list's memory (AP-40) on the real network drive: only timed with a made-up 10 ms delay per folder call
  in test Chromium; whether SMB's file dates change as expected when another computer saves is unseen.
- Who was here (AP-37) with two real computers on the network drive: others' editing files are only written in
  tests; whether a closing tab (not leaving to the list) gets its "left" file written in time is unseen.
- The storyboard timeline (SB-1) with real takes and camera files: waveforms and the preview were only seen with
  the fake WAV take and made-up SVGs; cut-on-a-word timing without a heard take is an estimate, never checked against a
  real voice; the drawer (SB-4) and its preview on a small real screen are unseen.
- Cuts timed from the take (SB-8): Whisper (`whisper-base_timestamped`) was never downloaded or run here (no Hugging
  Face); tests use a stand-in. Its word timings on a real voice, WebGPU vs WebAssembly, and the 150 MB download are unseen.
  Since SE-5 it's q8 on WebGPU too, served from the site (the deploy's pinned copies): speed on WebGPU unseen.
- Resolve / Premiere export (EX-19): the FCP7 XML was never opened in real Resolve or Premiere (neither runs here);
  only its tags, frames and the zip's files were checked. Relative media paths may need one relink; the mp4 in the
  test isn't measured (test Chromium has no H.264), so a real camera video's scale and length in the XML are unseen.
- The news folder (PF-15) on the real network drive: notes, their clean-up and the 2-minute full look were only seen
  in test Chromium with a made-up 10 ms delay; SMB listing a folder of a few hundred notes every 5 s is unmeasured.
- Check fast only with others (PF-16) with two real computers: others are only simulated by writing editing files.
- Away (PF-14) with two real computers on the network drive: the keeper handing over and rejoining as the newest was
  only seen with written files in tests; whether every real input device's movement reaches the page is unseen.
- Eight reads at once (PF-10) on the real network drive: only a made-up 10 ms delay per call was timed; how SMB
  takes bursts of up to ~32 reads (first visit to the list) is unseen.
- Recent History on open (PF-11) on the real network drive: only the made-up folder with a 10 ms delay was measured.
- The list's summary per script (PF-12) with two real computers: a summary matches only if both see the same file
  dates (script.md, takes); whether SMB gives every computer the same dates is unseen.
- History in chapters (PF-13) on the real network drive and with older app tabs open: packing and the 3-day removal
  were only seen in test Chromium (knobs `chapter-size`, `chapter-keep`); a chapter written while another computer
  reads History is unseen.
- Kept folders (PF-17) on the real network drive: a kept handle is trusted until a try in `patiently` fails; that a
  folder renamed or removed and made again on SMB behaves as in test Chromium (handles name a path) is unseen.
- The video export (SB-3) in real Chrome/Edge: only test Chromium's H.264 (software) and Opus were seen, read back
  with ffmpeg; real Chrome's AAC, hardware H.264, real camera .mov/.mp4 clips and a long script's memory are unseen.
- Feedback mode (AP-48) in real Chrome/Edge: the issue link was only caught in tests (no GitHub here); pasting the
  copied picture into a real GitHub issue and the `feedback` label (applied only for people who may label) are unseen.
- The policy (SE-1) in real Chrome/Edge with the real speech models: only a tiny ONNX session was seen loading the
  runtime from the app's own files; a real model download from Hugging Face under the policy is unseen.
- Dragging the playhead (SB-12) with a real take and a real mouse or touch screen: a take starting part way was only
  played as the fake WAV; nothing was heard here.
- Comments resolved by deleting a row or replacing words (RV-24) with two real computers: only one person's saves
  were seen; notes written while someone else's app reads comments are unseen.
- Dropping files onto a row (AP-52) from real Explorer: tests send made-up drag events; a real drag's outlines and
  dropping a folder or an Outlook attachment are unseen.
- Pasting a picture into a row (AP-54) from real Snipping Tool or Print Screen in Edge: tests put a PNG on test
  Chromium's clipboard and press a real Ctrl+V.
- Write ↗ on contacts (AP-55) with a real mail app on Windows: only the mailto link was checked.
- Allow editing (AP-25) after Chrome really takes back access: tests fake the lost OK; how long Chrome waits is unseen.
