// Folders kept for the visit (PF-17): each round looked up the script folder, `.studio/` and its folders again by
// name, one drive call each. A folder found (or made) once is kept; it is looked up again only after a folder call
// failed (`forgetFolders`, from `patiently`).

type Kept = Map<string, Promise<FileSystemDirectoryHandle>>;
let kept = new WeakMap<FileSystemDirectoryHandle, Kept>();

function inside(parent: FileSystemDirectoryHandle): Kept {
  let found = kept.get(parent);
  if (!found) kept.set(parent, (found = new Map()));
  return found;
}

/** The folder `name` in `parent`, made if `create`; throws like getDirectoryHandle when there is none. Look-ups at
 * once share one call (reads run several at a time, PF-10). */
export function subdir(parent: FileSystemDirectoryHandle, name: string, create = false): Promise<FileSystemDirectoryHandle> {
  const folders = inside(parent);
  const hit = folders.get(name);
  if (hit) return create ? hit.catch(() => look(folders, parent, name, true)) : hit;
  return look(folders, parent, name, create);
}

function look(folders: Kept, parent: FileSystemDirectoryHandle, name: string, create: boolean): Promise<FileSystemDirectoryHandle> {
  const found = parent.getDirectoryHandle(name, { create });
  folders.set(name, found);
  // A folder that isn't there isn't remembered: the next call looks again.
  found.catch(() => folders.get(name) === found && folders.delete(name));
  return found;
}

/** The folder at `path` below `parent`. */
export async function subpath(parent: FileSystemDirectoryHandle, path: string[], create = false): Promise<FileSystemDirectoryHandle> {
  let at = parent;
  for (const part of path) at = await subdir(at, part, create);
  return at;
}

/** `dir`, found by listing `parent`, or the same folder kept before: so a folder listed each round keeps what was
 * found inside it. No drive call. */
export async function known(parent: FileSystemDirectoryHandle, dir: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  const folders = inside(parent);
  const hit = await folders.get(dir.name)?.catch(() => undefined);
  if (hit) return hit;
  folders.set(dir.name, Promise.resolve(dir));
  return dir;
}

/** Looks every folder up by name again from now on: one was renamed, moved or removed. */
export function forgetFolders(): void {
  kept = new WeakMap();
}
