# `src/lib/forit.ts`

The For IT page's text (SE-8, board 93), as data: sections of paragraphs, lists, tables and checks, for the website
(`forIt(false)`) and the sealed file (`forIt(true)`). `screens/ForIT.svelte` shows it; `forItMarkdown()` makes
docs/for-it.md (the website's page, then the sections the sealed file says differently).

- **Used by:** `screens/ForIT.svelte`. **Tests:** `tests/unit/forit.test.ts`, `tests/e2e/forit.spec.ts`.

## Rules and pitfalls

- Text has only two kinds of markup, `code` and [label](https://… or #…), turned into pieces by `pieces` and shown as
  text and links: never HTML. A `javascript:` link stays plain text.
- The site's address, the refused permissions and any other address the policy allows are read from `csp.ts` and
  `headers.ts`. The stores the browser keeps are hand-written (`DATABASES`, `LOCAL_KEYS`): the unit test scans `src/`
  and fails on a database it doesn't list, or one it lists that the code no longer opens.
- After any change: `UPDATE_DOCS=1 npx vitest run forit` rewrites docs/for-it.md; the test fails until it matches.
- SECURITY.md's answer time (5 working days, the user's pick) is said here too; the test checks both.
- docs/asvs.md is hand-written (all 70 level 1 requirements); the page's ASVS table is its short version, so a status
  changed there changes here.
