# `src/screens/PreviewShot.svelte`

The playing preview's picture(s), inside the storyboard timeline's preview (`.screen`): the sequence's shot of the
moment, a collage's all, or a hold's last picture. Its own file so Timeline.svelte doesn't grow.

- **Used by:** `screens/Timeline.svelte`. **Tests:** `tests/e2e/timeline.spec.ts` (the cut test).

## Rules and pitfalls

- Issue #260: swapping a keyed `<img>` (or `<video>`) at a cut flickered black, as the browser drew the new element
  only once decoded. Folded, the pictures' blob URLs are only made when playing starts, so the next shot was never
  decoded before its cut. Each shot is now a layer over the last, `opacity: 0` until every picture in it is ready
  (`img.decode()`, a video's `loadeddata`); then the older layers go. `data-ready` marks a shown layer (tests use it).
- A picture that can't be decoded counts as ready, and none keeps the old shot for more than a second (`late`).
- A layer with no blob URLs (no pictures, or a missing file's name chip) shows at once. The card (`.pcard`, a row
  with no pictures or a placeholder) and the tag are Timeline's, drawn above the layers (`.pcard` is `relative`).
- The layer's key is its paths with their URLs: the same picture over a cut (a hold after its row) keeps its layer.
