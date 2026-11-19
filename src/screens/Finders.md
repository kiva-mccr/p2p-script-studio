# `src/screens/Finders.svelte`

The people on one "still to find or film" item in Assets (AS-2, #211, board 88): a chip each with × to take them
off, and + Who, which opens a picker under the item: the folder's people (Credits) not on it yet, a box that finds
them by name, and Add "name" for someone typed in.

- **Used by:** `screens/Assets.svelte`. **Tests:** `tests/e2e/assets.spec.ts`.

## Rules and pitfalls

- The folder's people are read the first time + Who is clicked in the tab (Assets keeps the promise), never on
  opening Assets: no extra network drive reads for people who never use it.
- Esc closes the picker without leaving the tab. It is in the page, not a browser dialog.
- It never writes the script: `onSet` gets the new list and Assets changes every line of that shot.
