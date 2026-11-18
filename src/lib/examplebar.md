# `src/lib/examplebar.svelte.ts`

The height of the example's bar (the blue "Example script" line with Take the tour and Start over), shared from
`App.svelte`, which measures it, to `Header.svelte`, which sticks under it (issue #203).

- **Used by:** `App.svelte`, `screens/Header.svelte`. **Tests:** `tests/e2e/example.spec.ts`.

## Rules and pitfalls

- The bar stays at the top of the window in the example, so you always see you're in it and can take the tour again,
  start over or leave. It scrolled away with the page before (issue #203).
- 0 when the bar isn't there: App sets it back on leaving the example, so a real folder's top bar sits at the top.
- `--example-h` on the page's root is the same height, for the list (no top bar there): `html`'s
  `scroll-padding-top` falls back to it when `--bar-h` isn't set.
