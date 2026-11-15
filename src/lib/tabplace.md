# tabplace.ts

Each tab of a script (Write, Review, History, Assets) keeps where you were scrolled in it (UX-3). `Editor` notes every
window scroll for the tab shown and calls `go` when the tab changes: the tab's place, or its top the first time.

## Rules and pitfalls
- A tab comes back taller for a moment and settles a few hundred ms later; one `scrollTo` landed 250 px off. `go` holds
  the place each frame until the page's height has been still for 10 frames (2 s at most).
- While holding, scrolls aren't noted (they are the app's own), and any wheel, touch, key or press lets go at once.
  So does a scroll while the height stands still (a settling page only moves when its height changes): the review
  test scrolls with `scrollTo`, which the hold pulled back.
- A jump by the app right after switching (a card, a flag, the Assets tab's row) must call `stop()` first, or the held
  place pulls the page back from the row.
