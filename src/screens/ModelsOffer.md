# `src/screens/ModelsOffer.svelte`

The speech models offered on the sealed app's first open (#327, board 92): a card under the top bar of the first screen
(Open your scripts folder) and the list, with "Import the models file…" and "Not now". Shown once on this computer, and
only when no models are kept; the note on it says Settings › Speech models has them later.

- **Used by:** `Setup.svelte`, `List.svelte` (`{#if __SEALED__}`). **Tests:** `tests/e2e/sealed.spec.ts`.

## Rules and pitfalls

- "Offered" is marked as soon as the card shows, in IndexedDB beside the models (`lib/sealedmodels.ts`): the only
  storage Chrome gives a file opened from disk. Closing the window without answering counts as seen.
- An older version's kept zip counts as offered: Settings says it's for an older version.
- The import is the same as Settings' (`addModels`); errors show in the card, never as a dialog.
- Its state is the module's, not each card's: picking a folder before answering swaps Setup for the list, and the
  card must stay (a new card would find it already offered and hide).
