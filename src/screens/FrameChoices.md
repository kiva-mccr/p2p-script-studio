# `src/screens/FrameChoices.svelte`

Frame size and Frames per second for the Resolve / Premiere and the video exports (#217, board 86). Each list of
choices ends with "Custom"; picking it shows a box beside it: your own rate (1 to 120, decimals allowed), or width ×
height with its shape ("4:5") shown.

- **Used by:** `screens/Export.svelte` (bound to `edit` and `video`). **Tests:** `tests/e2e/editexport.spec.ts`,
  `tests/e2e/video.spec.ts`.

## Rules and pitfalls

- The boxes are plain text fields (no `type="number"`, no browser validation bubbles): a value out of range turns
  the box's border and its range note red, and Export greys Save until it's fixed (`editFrame`/`editFps`,
  `videoFrame`/`videoFps` return null).
- `group` keeps the radio names apart between the two exports.
- `whole` (Resolve / Premiere): FCP7 XML counts whole frames, so a typed decimal that isn't NTSC (12.5) says what it
  is written as (lib/framing.md).
