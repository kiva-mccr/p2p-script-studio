# `src/screens/EditPreview.svelte`

The Resolve / Premiere export's preview (EX-19, board 68), in the export screen's middle: the timeline roughly as
the editors' apps show it (Marks, V1 and any stacked tracks above, A1 with the takes, C1 with captions), the .zip's
files, how to open it, and the links that aren't in the zip.

- **Used by:** `screens/Export.svelte`. **Tests:** `tests/e2e/editexport.spec.ts`.

## Rules and pitfalls

- Drawn from the same `plan` (`lib/editxml.ts`) the file is written from, so the preview can't disagree with it.
- Clips are placed in % of the whole length, like the storyboard timeline; very short clips are slivers with their
  names in the hover title.
- The "Opening it" lines are help (`class="help"`); the warnings about links are not.
