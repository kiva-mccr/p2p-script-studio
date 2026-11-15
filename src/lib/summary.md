# `src/lib/summary.ts`

The list's shared summary per script (PF-12, docs/studio-folder.md): `writeSummary` leaves a written-once file in a
script's `.studio/summary/` with the title, status, counts and everyone's For me, under the fingerprint they were
read with (`sharedPrint`, sha256); `readSummary` gives the newest one.

- **Used by:** `lib/scriptlist.svelte.ts`. **Tests:** `tests/e2e/listcache.spec.ts`, `tests/unit/forme.test.ts`.

## Rules and pitfalls

- A summary is only a shortcut: the reader checks its fingerprint against the files and reads the slow way when it
  differs, can't be read (half-written, mid-sync) or is missing. Never trust one without that check.
- The fingerprint is taken before the script is read, so a change during the read leaves a summary that no longer
  matches: safe, the next computer reads again.
- sha256, not the list's short hash: the file is shared, and a wrong match would show wrong counts until the next change.
- Written once, never changed; the writer removes summaries over 2 minutes old (by the name's time). Two computers
  writing at once leave two good summaries.
- No news note (lib/news.md): writing a summary changes nothing the list counts, and a note would send every list
  to look again.
- File dates must agree between computers for a summary to match (script.md's and the takes'); if a drive shows
  them differently, every computer just reads the slow way.
