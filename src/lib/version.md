# `src/lib/version.ts`

The live version, "Version: PR #N" in the ? menu of the top bar (AP-28, SB-5): the number of the pull request the site was built from, its
title and when it was merged, so a refresh shows whether a new version is live and what is in it.

- **Used by:** `screens/HelpMenu.svelte`, and `vite.config.ts` (reads the commit at build time). **Tests:** `tests/unit/version.test.ts`, `tests/e2e/app.spec.ts`.

## Rules and pitfalls

- The number is baked in when the site is built: `deploy.yml` sets `LIVE_BUILD`, and `vite.config.ts` then reads the
  last commit (a merge commit on main). Any other build (dev, tests) shows "dev".
- A merge that changes only `.md` or docs doesn't deploy, so the number stays on the last code change, which is
  what is really running.
- GitHub's merge commit has "Merge pull request #N from …" as its subject and the PR's title as its body; a squash
  merge is "Title (#N)". Anything else gives no version.
