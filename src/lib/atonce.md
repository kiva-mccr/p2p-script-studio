# `src/lib/atonce.ts`

`eachAtOnce`: runs a piece of work for every item, eight at a time (PF-10), and gives the results in the items'
order. A network drive takes about as long to answer eight calls as one, so reading files one after another spent
most of the time waiting.

- **Used by:** `lib/history.ts` (versions), `lib/comments.ts` (notes), `lib/voice.svelte.ts` (takes),
  `lib/scriptlist.svelte.ts` (take dates), `lib/editmedia.ts` (Save .zip's media). **Tests:** `tests/unit/atonce.test.ts`.

## Rules and pitfalls

- Same calls as before, only overlapped: never use it to read more than the one-by-one loop did.
- Results come back in the items' order, whatever order the reads finish in; anything that depends on order (History,
  the zip's files) builds from the results, never from the moment each one finishes.
- One failure stops new work and fails the whole call, so a read that may fail (a half-synced file) catches inside
  `work` and returns nothing for that item.
- Not nested on purpose, but it can be: the script list reads four scripts at once (`WORKERS`), each with its own
  eight, so a first visit can have about 32 reads at the drive at once. Later visits read little (HI-3, PF-9).
- A slot can hold CPU work too (Save .zip draws and decodes in it): eight pictures decoded at once is the memory
  ceiling, so don't raise `AT_ONCE` without checking a zip of camera photos.
