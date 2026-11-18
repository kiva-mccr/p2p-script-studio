# `src/lib/sealedfile.ts`

The sealed file's name and the facts beside it (`script-studio-sealed.json`: SHA-256 in upper-case hex as
PowerShell's Get-FileHash shows it, size, policy), `policyOf` and `unsealed` (what in a policy names a site or isn't
locked down). No Node or browser imports: the build, the Download sealed page and `scripts/livecheck.ts` share it.

- **Used by:** `lib/sealed.ts`, `screens/DownloadSealed.svelte`, `scripts/livecheck.ts`. **Tests:** `tests/unit/sealed.test.ts`.

## Rules and pitfalls

- Imported by the live check in plain Node (`--experimental-strip-types`): keep it free of imports.
