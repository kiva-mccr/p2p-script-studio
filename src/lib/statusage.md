# `src/lib/statusage.ts`

How long a script has been in its status (#230, board 87): `statusAge` gives the pill's "2 days" and its hover, "Sent
for review by Sam, Monday, Nov 16, 3:12 pm", from History's newest review entry. `howLong`: "12 min", "3 h", "5 days",
"3 weeks", "4 months".

- **Used by:** `screens/Editor.svelte` (passes it to `Header.svelte`). **Tests:** `tests/unit/statusage.test.ts`,
  `tests/e2e/review.spec.ts`.

## Rules and pitfalls

- Only an entry that set the status counts: "Sent for review" for in review, "Approved…" for approved. A status
  changed by hand in script.md (Notepad) has no such entry, so the pill shows no age rather than a wrong one.
- The versions are the Editor's recent ones (PF-11, back to the newest send for review), which always hold the
  newest review entry.
