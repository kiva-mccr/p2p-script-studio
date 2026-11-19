# `src/screens/Timeline.svelte`

The storyboard timeline (SB-1, board 63), in a drawer at the bottom of the screen (SB-4, board 76) in Write and Review: a ruler, the sections, the rows with their
pictures (sequence or collage, or the On screen words on a grey card), holds and placeholders, and the voice-over as
a waveform (a dashed "no take" bar for read time). A click picks a block: its row lights up and the panel below
offers its pictures, Sequence or Collage, + Add a picture (only for the timeline), + Hold or + Placeholder, and
▶ Play from here; a hold or placeholder gets its seconds and words, and ✕ Remove.

- **Used by:** `screens/Write.svelte`, `screens/Review.svelte` (read only). The playing preview is
  `TimelinePreview.svelte`. **Tests:** `tests/e2e/timeline.spec.ts`.

## Rules and pitfalls

- Feedback's Cover (lib/feedback.md): the section titles, a block's On screen words, a placeholder's label and the hover
  text are buttons' words but the script's, so they sit in `data-hide`; the ruler is `data-keep` (its times name nobody,
  issue #334: it was the other way round).
- A row with no picture and no On screen words shows a small icon (a picture with a line through it), centred in its
  block (#264); its words "No picture" are in the block's hover text and name instead. The icon is drawn in `currentColor`.
- The hover text (UX-8) lines up with the block's right edge (`.tip.end`) when it would run past the timeline's box or
  the window on the right (`showTip` measures; `TIP` is its width with padding).
- Mostly a view: every choice goes into the row's `Timeline:` line through `onTimeline` (or its Files through
  `onFiles`), so it saves, merges and shows in History like any edit. Never keep timeline state anywhere else.
- Lengths come from `layout` (`lib/timeline.ts`) with `rowLength` (`lib/voice.svelte.ts`), as Play the script and
  the Resolve / Premiere export: the take's length, else the read time at the speaking speed. A row with neither is left off.
- Blocks are placed with `left`/`width` in % of the whole length, inside a box zoomed by its width; the box scrolls
  sideways, the page doesn't.
- It opens at `fitZoom` (issue #243: a long timeline opened whole was unreadable), measured by `use:fit` the first
  time the tracks show; once set (or zoomed by hand) it isn't refitted, so editing or folding never jumps the zoom.
- Pictures and waveforms are only made once the timeline comes near the screen (`use:near`, as AP-39): made at
  once, they slowed opening a script enough to fail tests under load.
- Pictures are blob URLs from the script's folder, made while the timeline is shown and revoked after; a missing
  file is a grey stand-in. A video's block shows a still from its start (`stills`, made by `makePreview` as Assets'
  thumbnails, two at a time; never a `<video>` per block, AP-39); while it's being made, or if the browser can't play
  it, the dark "▶ name" chip. That chip alone looked unloaded (issue #205). The playing preview plays the video itself. Waveforms come from `lib/waveform.ts`, made once per take.
- The drawer (SB-4): the section is always `position: sticky; bottom: 0`, so it stays at the bottom of the screen and,
  scrolled to the end, rests under the last row (the last row is never behind it). Its bar (`.foldbar`, not `.bar`:
  that is TimelineBar's class, which tests look for) folds and unfolds it, playing or not; folded, a thin `.strip` of
  the blocks and the playhead. Fold / Unfold is its own button (`.fold`), the last in `.top`, so it sits at the far
  right after Wide / Upright and zoom (SB-10, #238); never put it back inside `.foldbar`. Remembered in this browser for every script (`timeline-open`, '1' open); it starts
  folded. It replaced SB-2's Unpin / Pin and the old Hide (`timeline-hidden`, `timeline-unpinned` are no longer read).
- Open, the strip (the `strip` snippet, `.strip.open`, `role="scrollbar"`) is the tracks' scroll bar, under them in
  `.slider` with ◀ ▶ (`.step`) at its ends (SB-18, #336, board 92); `.scroll` hides the browser's own bar
  (`scrollbar-width: none`), so Shift + wheel and trackpads still scroll it. Sections (`.mark-s`) sit above the blocks
  (`.mark-b`); `.view` boxes the part in view (SB-9, #245): `use:inView` measures `.scroll` on scroll and on resize of
  it and of `.tracks` (zoom changes the tracks' width, not the box's). Picked blocks are `.on` there; the playhead only
  while playing. A press inside the box drags it from where it was held, elsewhere centres it there; letting go, ◀ ▶,
  ← → and Home / End call `showMiddle`, which brings the row in the middle of the view into the script's view
  (`onShow`), never while playing (Play moves the page itself). Its marks are `pointer-events: none`, so the press
  measures against the strip.
- The tour (SB-7) opens the drawer for its timeline step through the window's `tour-drawer` event and folds it again
  after, only if it opened it (`byTour`); not remembered. Folding or opening by hand clears `byTour`.
- Open, the tracks and panel scroll inside `.body` (at most about half the screen), never the section: overflow on
  the section would clip the preview above it.
- `use:room` keeps the drawer's height as the page's `scroll-padding-bottom` (so `scrollIntoView` lands rows above
  it) and as `--drawer`, which lifts Undo (App) and the messages (Editor) above it; code that scrolls only "when not in view" compares with `floor()` (`lib/floor.ts`), not `innerHeight`.
- Recording (SB-14, #251, board 84): the row being recorded lasts as long as it has been recording (`lengths`, a
  200 ms clock from `voice.started`), so its take shows red (`.vo.rec`) and grows, and the rows after it move right.
  Its old waveform isn't shown meanwhile, and it is left out of `toHear` (no take file yet to hear).
- Folded, pictures are not made, except while playing (for the preview); waveforms only open.
- Playing (or paused, `player.started`), the picked block and its row (Write's `lit`) don't light up (#335): only
  the playing row and block move. The pick is kept, so the panel comes back when it stops.
- Playing: the panel is hidden, a playhead runs at `player.time`, and the preview (`TimelinePreview.svelte`, #226,
  board 85) shows the picture of the moment: the sequence's shot at `player.elapsed`, a collage's all, a hold the
  last picture before it, a placeholder its words. Open, it is docked in `.body`, right of the tracks (`.beside`:
  `.lanes` holds the strip and `.scroll`, so the strip's box matches the tracks); folded, above the drawer's right
  end, so it never covers the timeline (the user's condition from SB-2); big (⤢), floating, wherever it was left.
  It is rendered in one place or the other (the `preview` snippet), so moving between them remounts it; `big` stays
  here so it survives that. Step ids are block ids (`plan` is made from `layout`). The picture itself is
  `PreviewShot.svelte`, which keeps the old shot until the next is decoded (issue #260).
- The playhead drags (SB-12, #207, board 80), playing or paused (`player.started`): its dot (`.grip`, a 32 × 26 button
  round a 14 px dot) sits in the ruler's top band, above its times (the user: never on them); the ruler is 32 px for it.
  A press on the dot or the ruler grabs it (pointer capture), pausing; `drag` holds the time meanwhile, and `now`,
  `into` and `headTime` follow it, so the preview shows what's under it. Near the box's sides (`EDGE`) a rAF loop
  scrolls the tracks; the time is taken from the pointer clamped to the box, so the head stays at the edge. Let go:
  `player.seek` plays from there. Stopping while held drops the drag.
- Playing, the tracks follow the playhead a page at a time, unless scrolled by hand in the last `OWN` ms: only a
  wheel or touch on the box, or the strip and ◀ ▶ under it (#336), count, never a scroll event (focusing the dot
  scrolls too). `ownAt` starts at -Infinity: `performance.now()` counts from the page's load, so 0 blocked following for the
  first 5 s.
- ✕ on the preview closes it (SB-11, #225): kept in this browser for every script (`timeline-preview`, 'closed'), so
  it stays closed when playing again, until Show preview (`.show`, in `.top`, only while playing with it closed; blue text with a picture icon, styled
  like Fold, #333).
  Folded with it closed, no pictures are made. The time in its bar never wraps (it ellipsizes): with ✕ the bar of the
  small upright preview wrapped, made it taller and ran it under the top bar in a short window.
- Cut on a word: the dialogue's words as buttons; a click toggles a cut there (at most one fewer than the
  pictures). Saved as the words (`cuts at "water"`), matched again in order; a repeated word is saved with the
  words after it that tell it apart (`cutWords`), never as the word alone, which would land on its first time.
  The look (board 78, option B): a blue line with the next picture's number before each cut word, the word outlined,
  a dashed line on hover where a cut would go. With every
  cut used, a click moves the nearest cut; the first word takes none. The word just clicked shows no hover line
  until the pointer leaves it (`quiet`): taking a cut off left the dashed line behind, which looked like a cut.
- `readOnly` (Review): no panel and no choices; a click on a block comments on its row (`onComment`; a hold or
  placeholder on the row before), saved with `on: 'timeline'`.
- Wide / Upright (SB-3) is the script's (front matter `shape`, through `onShape`), not this browser's: the video export
  and EX-19's collages follow it. Upright, the preview is 9:16 and a collage stacks its pictures.
  Not shown in Review (read only).
- `drawerH` (from `use:room`) is passed to the preview so the big one stays above the drawer; its first place is
  above the drawer's right end (`end`).
- A click on a block always brings its row into view (`onShow`), since the drawer never leaves the screen; SB-2's
  "↑ Go to the row" went with it.
- `selected` is shared with Write's bars (`TimelineBar.svelte`): picking a hold on the timeline opens its bar's
  editor in the script too.
- SB-8: in Write (not `readOnly`), the takes of rows cut on a word that have no heard `words` yet are handed to
  `voice.hearAll` (`toHear`). The cut panel's `.timed` line says where the cut times come from (`timedBy`): heard in
  the take, or estimated (no take, not heard yet, being heard, couldn't be heard). Status, so not `help`.
