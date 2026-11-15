# `src/lib/timeline.ts`

The storyboard timeline (SB-1, mock-up 63): reads and writes a row's `Timeline:` line (`readChoices`,
`writeChoices`, `changeChoices`), lists a row's pictures (`pictureFiles`, `picks`), and lays the script out in time
(`layout`): rows, then the hold or placeholder after each, and the sections' spans. `shots` splits a sequence's
time between its pictures, on the cut words when the take's word timings are known (`cutTimes`), else equally.

The video's shape (SB-3) is the front matter's `shape: upright`, else wide (`shapeOf`, `withShape`).

- **Used by:** `screens/Timeline.svelte`, `screens/Write.svelte`, `screens/Export.svelte`, `lib/merge.ts` (shape). **Tests:** `tests/unit/timeline.test.ts`.

## Rules and pitfalls

- The line holds only what differs from the default; `writeChoices` of the default is '' (no line at all).
- Parts it doesn't understand are kept in `rest` and written back, so a later feature's parts survive older apps.
- Lengths come from one place, `rowLength` (`lib/voice.svelte.ts`), shared by the timeline, Play the script and the
  Resolve / Premiere export (EX-19), so the playhead and the exported timeline never drift.
- Word timings are estimated (`estimateWords`: by letters, over the row's length), not heard: no speech model
  reads the takes yet. Good enough to cut on; refine later if real takes drift.
- Wide is the default and is never written: `withShape(…, 'wide')` removes the line (a front matter left empty is
  `null`, so no empty `---` block is written).
- A cut word is matched by `plain` (lower case, letters and digits only), the first match after the previous cut.
