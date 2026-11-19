# `src/screens/SealedModels.svelte`

Settings' Speech models section, in the sealed app only (SE-5, board 89): not added, added (with Remove), or for an
older version, and "Add speech-models.zip…", which checks the zip file by file before keeping it.

- **Used by:** `Settings.svelte` (`{#if __SEALED__}`). **Tests:** `tests/e2e/sealed.spec.ts`.

## Rules and pitfalls

- It can't link to the download (the sealed app reaches no site, and SealedLinks only copies addresses): it names the
  Download sealed page instead.
- Errors are shown in the page, never as a dialog.
- The first-open card (`ModelsOffer.svelte`, #327) points here: keep the heading "Speech models" or change its note.
