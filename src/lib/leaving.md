# `src/lib/leaving.ts`

`closing(work)` and `closed()`: what a script screen still writes as it closes (the Editor's `leave()` and its "… was
here" file), so the example's Start over and Undo (`App.svelte`) can wait for it before swapping the folder.

- **Used by:** `screens/Editor.svelte`, `App.svelte`. **Tests:** `tests/e2e/example.spec.ts` (Start over, with Undo).

## Rules and pitfalls

- Folder handles name a path: a closed screen's late write lands in whatever folder now has that name. Before Start
  over or Undo the App first closes the screens (`swapping`), then awaits `closed()`, then swaps; otherwise the
  closing Editor saved its text (and a "folded" note) into the copy Undo had just put back, and the edit was lost.
- A failed write is swallowed here; the Editor reports its own problems.
