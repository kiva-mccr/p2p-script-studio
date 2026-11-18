// The speech models served from the app (SE-5): the pinned files (models.lock.json) and the zip the sealed app takes.
// Shared by the deploy's script (scripts/models.ts), the app and the live check: no Node or browser imports.

/** For each model: the revision (a Hugging Face commit) and each file's SHA-256 (hex) and size. */
export type ModelsLock = Record<string, { revision: string; files: Record<string, { sha256: string; bytes: number }> }>;

/** The sealed app's second download: every model file, stored (not compressed), named "<model>/<path>". */
export const MODELS_ZIP = 'speech-models.zip';
/** Beside the website (speech-models.json): where the zip is (a GitHub release asset), its SHA-256 and size. */
export type ModelsZip = { tag: string; url: string; sha256: string; bytes: number };

/** The release that holds the zip: one per pinned set of revisions. */
export function modelsTag(lock: ModelsLock): string {
  return 'speech-models-' + Object.values(lock).map((m) => m.revision.slice(0, 7)).join('-');
}
