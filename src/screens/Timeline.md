# `src/screens/Timeline.svelte`

The storyboard timeline (SB-1, board 63), under the last row in Write: a ruler, the sections, the rows with their
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
- Playing: the section is `position: sticky; bottom: 0` while `pinned` (`player.started`, not unpinned),
  the panel is hidden, a playhead runs at `player.time`, and the preview (16:9, 320 px, ⤢ to 720 px) sits above the
  right end showing the picture of the moment: the sequence's shot at `player.elapsed`, a collage's all, a hold the
  last picture before it, a placeholder its words. Step ids are block ids (`plan` is made from `layout`).
- Cut on a word: the dialogue's words as buttons; a click toggles a cut there (at most one fewer than the
  pictures). Saved as the words (`cuts at "water"`), matched again in order, so picking the second of two equal
  words lands on the first: a known limit.
- `readOnly` (Review): no panel and no choices; a click on a block comments on its row (`onComment`; a hold or
  placeholder on the row before), saved with `on: 'timeline'`.
- Wide / Upright (SB-3) is the script's (front matter `shape`, through `onShape`), not this browser's: the video export
  and EX-19's collages follow it. Upright, the preview is 9:16 (180 px, ⤢ 405 px) and a collage stacks its pictures.
  Not shown in Review (read only).
- Hide is this browser's choice (`timeline-hidden`), for every script; so is Unpin (SB-2, `timeline-unpinned`).
- Unpinned while playing, the preview is `.corner` (fixed, bottom right, above the GitHub link) only while no part
  of the timeline is on screen (`use:watch`); once any shows it goes back above the right end, so it never covers
  the timeline or its buttons (the user's condition). `.timeline` is `position: relative` so that works unpinned.
- A click on a block scrolls to its row only while `pinned`: under the last row, the jump left the sequence or
  collage being changed (the user, 2026-11-15). The row panel's "↑ Go to the row" does it on purpose.
- `selected` is shared with Write's bars (`TimelineBar.svelte`): picking a hold on the timeline opens its bar's
  editor in the script too.
