# `src/lib/video.ts`

The storyboard timeline as a video (SB-3, board 70): `makeVideo` draws the Resolve / Premiere plan (lib/editxml.ts,
V1 and the captions) frame by frame on a canvas, mixes the takes (and, if asked, videos' own sound) into one mono
track, and encodes both in the browser with WebCodecs, packed by mediabunny. `frame` draws one moment for the preview
with the same code. Small helpers: `frameSize`, `megabytes`, `itemAt`, `captionAt`, `wrap`.

- **Used by:** `screens/Export.svelte`, `screens/VideoPreview.svelte`. **Tests:** `tests/unit/video.test.ts`,
  `tests/e2e/video.spec.ts`.

## Rules and pitfalls

- MP4 (H.264, with AAC or Opus) if the browser can encode H.264 at that size, else WebM (VP9 or VP8, Opus); the page
  says when it fell back. Test Chromium encodes H.264 (with Opus) but can't play it: tests read the file back with
  mediabunny in Node, never in a `<video>`.
- mediabunny is imported only when a video is made or read (`await import`), so the app doesn't carry it (~760 kB).
- 30 fps. Stills and cards are drawn every frame (cheap); a video clip is decoded in order with `CanvasSink`
  (`canvasesAtTimestamps`), held on its last frame past its end. A video it can't decode shows its first frame (via a
  `<video>`), and a file that can't be read is a grey card with its name, listed in `missing`.
- Sound is given to the encoder a second at a time, about a second ahead of the picture, so the file interleaves.
- The whole mix is one Float32Array (48 kHz mono: about 11 MB a minute), and the file is kept in memory until saved
  (`BufferTarget`, about 20 MB a minute at 1080p). A very long script at 1080p is the memory peak.
- Stop is checked between frames and cancels the output; nothing is saved.
- Pictures fit inside the frame on black, never cropped; captions are white on a dark band at the foot, at most three
  lines, at 1/22 of the frame's short side.
