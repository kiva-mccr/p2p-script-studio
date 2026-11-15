# `src/screens/VideoPreview.svelte`

The video export's preview (SB-3, board 70): one moment of the video on a canvas (drawn by `frame` in lib/video.ts,
the same code that makes the file), the picture track's clips underneath to pick the moment, and, once made, the
video itself playing. While a video is being made: the progress and Stop.

- **Used by:** `screens/Export.svelte`. **Tests:** `tests/e2e/video.spec.ts`.

## Rules and pitfalls

- The canvas is drawn at a third of the frame's size, so picking is quick; cards and captions scale with it.
- The moment shown is half a second into the clip (or its middle), so a caption that starts with the clip shows.
- A video clip shows its first frame here (the file plays it).
- The made video's object URL belongs to Export.svelte, which frees it when a newer one is made or the screen closes.
