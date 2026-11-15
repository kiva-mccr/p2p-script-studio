# `src/lib/editmedia.ts`

Makes the Resolve / Premiere .zip (EX-19): `editZip` reads each media file the plan needs, copies pictures and
videos as they are, draws .svg pictures, cards and collages as PNGs at the frame's size, a video's last frame for a
hold, turns takes into WAV, measures them for the XML, and zips the .xml (and .srt) with them.

- **Used by:** `screens/Export.svelte`, `lib/video.ts` (drawing). **Tests:** `tests/e2e/editexport.spec.ts`.

## Rules and pitfalls

- Media are made eight at a time (PF-10, `lib/atonce.ts`): reads overlap, the zip keeps the plan's order, and a file
  that fails is only `missing`. Eight decoded camera photos at once is the memory peak.
- Takes are decoded and `cleaned` (crop and gain, AU-4) like the voice-over export, at 48 kHz mono.
- A file that can't be read is left out and named in `missing`; its clip stays in the XML, so the editor sees it
  offline rather than losing its place.
- Videos are measured with a `<video>` element; one the browser can't play (test Chromium has no H.264) is still
  copied, without its size or length, and a hold after it can't get its last frame (left out, as above).
- Object URLs are freed after use (images once loaded, videos once drawn or measured).
- `collage` stacks the pictures one above the other in an upright frame (SB-3), side by side in a wide one. The
  drawing helpers (`fit`, `card`, `collage`, `picture`) are shared with the video export (lib/video.ts).
- Cards use the page's font at 1/16 of the frame's short side, at most eight lines.
