# `src/lib/timeline.ts`

The storyboard timeline (SB-1, mock-up 63): reads and writes a row's `Timeline:` line (`readChoices`,
`writeChoices`, `changeChoices`), lists a row's pictures (`pictureFiles`, `picks`), and lays the script out in time
(`layout`): rows, then the hold or placeholder after each, and the sections' spans. `shots` splits a sequence's
time between its pictures, on the cut words when the take's word timings are known (`cutTimes`), else equally.

`fitZoom` (issue #243) picks the zoom the timeline opens at: the least, doubling from 1× to `ZOOM_MAX` (64×), that
gives the median row `readable` (120) pixels.

The video's shape (SB-3) is the front matter's `shape: upright`, else wide (`shapeOf`, `withShape`).

- **Used by:** `screens/Timeline.svelte`, `screens/Write.svelte`, `screens/Export.svelte`, `lib/merge.ts` (shape). **Tests:** `tests/unit/timeline.test.ts`.

## Rules and pitfalls

- The line holds only what differs from the default; `writeChoices` of the default is '' (no line at all).
- Parts it doesn't understand are kept in `rest` and written back, so a later feature's parts survive older apps.
- Lengths come from one place, `rowLength` (`lib/voice.svelte.ts`), shared by the timeline, Play the script and the
  Resolve / Premiere export (EX-19), so the playhead and the exported timeline never drift.
- Word timings (SB-8): heard in the take when it has been (`heardWords`, from the take's `words`, through
  `rowLength`'s `words`), else estimated (`estimateWords`: by letters, over the row's length). `heardWords` matches
  the dialogue's words to the heard ones in order (longest common run), takes off the crop's `from`, keeps times in
  order and inside the take, and spreads unheard words (numbers said as words, mishearings) by letters between the
  heard ones. Null when no word matches, and the estimate is used.
- Wide is the default and is never written: `withShape(…, 'wide')` removes the line (a front matter left empty is
  `null`, so no empty `---` block is written).
- A cut word is matched by `plain` (lower case, letters and digits only), the first match after the previous cut.
  A cut can be a few words: the first is where it falls, the rest only tell a repeated word apart. `cutWords` adds
  words after it until the first match is the one picked (a word of only marks, "—", is skipped and cuts on the
  next word). `cutTimes` goes through `cutPositions`, so the timeline, the preview and the exports always agree.
