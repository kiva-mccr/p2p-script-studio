# `src/App.svelte`

The app's one page: finds the remembered folder (`lib/remember.ts`), shows the first-time screen if there is none,
then the screen the link names (`lib/route.ts`): the list for `#/`, a script for `#/<folder name>`.

Also the example to try (AP-33): opened in place of the folder with a blue strip on top (Start over, through an Undo
bar, and Open your scripts folder).

Also the Download sealed page for `#download-sealed` (SE-10, website only), and in the sealed app `SealedLinks`.

- **Tests:** `tests/e2e/sealed.spec.ts`, `tests/e2e/app.spec.ts`, `tests/e2e/setup.spec.ts`, `tests/e2e/example.spec.ts`.

## Rules and pitfalls

- Colours come from the variables in `app.css`, never copied into a component.
- The link's `#/…` is never touched by the first-time screen, so a link still opens its script after set-up.
- GitHub, the live version and Feedback are in the ? menu of every top bar (`HelpMenu.svelte`, SB-5); nothing sits
  in the bottom corners any more (they floated over the script and the timeline's drawer). App only mounts
  `Feedback.svelte` once, so its strip and panel outlive the top bars.
- The editor is keyed by the script's path, so following a link to another script starts it fresh.
- A link ending in `?review` (a shared link, RV-10) opens the script on Review. The mark is taken out of the address
  with `history.replaceState` (no hashchange), so a reload after moving to Write stays in Write.
- The example is never saved as the remembered folder. Being in it is kept per tab (sessionStorage), so a reload
  stays in it; leaving it clears the link's `#/…`, since its script means nothing in the real folder.
- The picked folder is remembered (IndexedDB) before the list shows: saved after, a reload straight away found no
  folder (a flaky set-up test under load).
- The example's blue strip is sticky at the top (issue #203), over the script's top bar (z 8 over 7), which sticks
  under it at `exampleBar.height` (`lib/examplebar.svelte.ts`). Its buttons get the same scroll margin as the top
  bar's, or focusing Take the tour scrolled the page to "show" it.
- Start over and its Undo close the example's screens first (`swapping`) and wait for their last saves (`closed()`,
  `lib/leaving.ts`) before swapping the folder: the Editor closed by the swap used to write its text into the copy
  Undo had just put back, so the edit was lost (a flaky example.spec test under load).
