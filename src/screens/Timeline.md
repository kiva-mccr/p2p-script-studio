# `src/screens/Timeline.svelte`

The storyboard timeline (SB-1, board 63), in a drawer at the bottom of the screen (SB-4, board 76) in Write and Review: a ruler, the sections, the rows with their
pictures (sequence or collage, or the On screen words on a grey card), holds and placeholders, and the voice-over as
a waveform (a dashed "no take" bar for read time). A click picks a block: its row lights up and the panel below
offers its pictures, Sequence or Collage, + Add a picture (only for the timeline), + Hold or + Placeholder, and
▶ Play from here; a hold or placeholder gets its seconds and words, and ✕ Remove.

- **Used by:** `screens/Write.svelte`, `screens/Review.svelte` (read only). **Tests:** `tests/e2e/timeline.spec.ts`.

## Rules and pitfalls

- The hover text (UX-8) lines up with the block's right edge (`.tip.end`) when it would run past the timeline's box or
  the window on the right (`showTip` measures; `TIP` is its width with padding).
- Mostly a view: every choice goes into the row's `Timeline:` line through `onTimeline` (or its Files through
  `onFiles`), so it saves, merges and shows in History like any edit. Never keep timeline state anywhere else.
- Lengths come from `layout` (`lib/timeline.ts`) with `rowLength` (`lib/voice.svelte.ts`), as Play the script and
  the Resolve / Premiere export: the take's length, else the read time at the speaking speed. A row with neither is left off.
- Blocks are placed with `left`/`width` in % of the whole length, inside a box zoomed by its width; the box scrolls
  sideways, the page doesn't.
- Pictures and waveforms are only made once the timeline comes near the screen (`use:near`, as AP-39): made at
  once, they slowed opening a script enough to fail tests under load.
- Pictures are blob URLs from the script's folder, made while the timeline is shown and revoked after; a missing
  file is a grey stand-in. Waveforms come from `lib/waveform.ts`, made once per take.
- The drawer (SB-4): the section is always `position: sticky; bottom: 0`, so it stays at the bottom of the screen and,
  scrolled to the end, rests under the last row (the last row is never behind it). Its bar (`.foldbar`, not `.bar`:
  that is TimelineBar's class, which tests look for) folds and unfolds it, playing or not; folded, a thin `.strip` of
  the blocks and the playhead. Remembered in this browser for every script (`timeline-open`, '1' open); it starts
  folded. It replaced SB-2's Unpin / Pin and the old Hide (`timeline-hidden`, `timeline-unpinned` are no longer read).
- Open, the tracks and panel scroll inside `.body` (at most about half the screen), never the section: overflow on
  the section would clip the preview above it.
- `use:room` keeps the drawer's height as the page's `scroll-padding-bottom` (so `scrollIntoView` lands rows above
  it) and as `--drawer`, which lifts the fixed corner links (App), Undo and the messages (Editor) above it; the
  preview sits 40 px above the drawer to clear those links; code that scrolls only "when not in view" compares with `floor()` (`lib/floor.ts`), not `innerHeight`.
- Folded, pictures are not made, except while playing (for the preview); waveforms only open.
- Playing: the panel is hidden, a playhead runs at `player.time`, and the preview (16:9, 320 px, ⤢ to 720 px) sits above the
  drawer's right end, folded or open, so it never covers the timeline (the user's condition from SB-2), showing the picture of the moment: the sequence's shot at `player.elapsed`, a collage's all, a hold the
  last picture before it, a placeholder its words. Step ids are block ids (`plan` is made from `layout`).
- Cut on a word: the dialogue's words as buttons; a click toggles a cut there (at most one fewer than the
  pictures). Saved as the words (`cuts at "water"`), matched again in order, so picking the second of two equal
  words lands on the first: a known limit.
- `readOnly` (Review): no panel and no choices; a click on a block comments on its row (`onComment`; a hold or
  placeholder on the row before), saved with `on: 'timeline'`.
- Wide / Upright (SB-3) is the script's (front matter `shape`, through `onShape`), not this browser's: the video export
  and EX-19's collages follow it. Upright, the preview is 9:16 (180 px, ⤢ 405 px) and a collage stacks its pictures.
  Not shown in Review (read only).
- A click on a block always brings its row into view (`onShow`), since the drawer never leaves the screen; SB-2's
  "↑ Go to the row" went with it.
- `selected` is shared with Write's bars (`TimelineBar.svelte`): picking a hold on the timeline opens its bar's
  editor in the script too.
