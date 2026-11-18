# `src/screens/EditPreview.svelte`

The Resolve / Premiere export's preview (EX-19, board 68), in the export screen's middle: the timeline roughly as
the editors' apps show it (Marks, V1 and any stacked tracks above, A1 with the takes, C1 with captions), the .zip's
files, how to open it, and the links that aren't in the zip.

- **Used by:** `screens/Export.svelte`. **Tests:** `tests/e2e/editexport.spec.ts`.

## Rules and pitfalls

- Drawn from the same `plan` (`lib/editxml.ts`) the file is written from, so the preview can't disagree with it.
- Clips are placed in % of the whole length, like the storyboard timeline, inside `.lanes`, which is `zoom × 100%`
  wide in `.scroll` (overflow-x): the page never scrolls sideways (#254, board 79). The names column sits outside
  the scroll, so its heights (`h-*` classes) must match the lanes'.
- A clip's name shows only when about ten letters fit at the current zoom (`fits`, from the scroll's measured
  width); otherwise it's a bare block with its name and length in the hover title. Each clip is 1 px short of its
  length (a gap) and at least 3 px wide.
- Lanes clip what overflows (`overflow: hidden`), so pins and labels never leave the box. Marks are 2 px pins (hover:
  the marker's name and time); the Sections row comes from `plan.sections`, only when markers are on.
- Takes alternate two solid greens (`.odd`), never stripes: the user found the banding hid where one take ends.
- The "Opening it" lines are help (`class="help"`); the warnings about links are not.
