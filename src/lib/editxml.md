# `src/lib/editxml.ts`

The storyboard timeline for DaVinci Resolve and Premiere Pro (EX-19, board 68): `plan` (what goes on V1, any
stacked tracks, A1, the markers and captions, and which media files are needed), `toXml` (Final Cut Pro 7 XML,
"xmeml" version 5) and `toSrt` (the dialogue as captions). `EDIT` is the default settings.

- **Used by:** `screens/Export.svelte`, `screens/EditPreview.svelte`, `lib/editmedia.ts`.
  **Tests:** `tests/unit/editxml.test.ts`, `tests/e2e/editexport.spec.ts`.

## Rules and pitfalls

- Timings come from `layout` (`lib/timeline.ts`), so the export matches the timeline under the script and Play.
- One XML for both apps: FCPXML is Final Cut X's (Resolve only), EDL can't carry stills. Premiere and Resolve both
  import FCP7 XML; neither app runs here, so the file was never opened in either (a known gap).
- Paths are relative (`media/<name>`), because the browser can't know where the zip will be unpacked. Both apps may
  ask once where the media is; the preview says to point at the media folder.
- A file is described in full once (`<file id>` with its name, path, rate, length and size) and referred to by id
  after; a held still is one longer clip, not two.
- Frames are counted from each clip's start and end in seconds (not by adding lengths), so rounding never drifts.
  29.97 is timebase 30 with `ntsc` TRUE, counted at 30000/1001.
- A picture whose size is known and isn't the frame's gets a Basic Motion scale to fit; made PNGs (cards, collages,
  .svg) are drawn at the frame's size and need none. A video or take shorter than its turn ends early (a gap).
- Media names are the files' own names, made unique ("leaf-2.jpg") when two paths share one.
