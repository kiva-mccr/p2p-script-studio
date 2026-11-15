import { describe, expect, it } from 'vitest';
import { forgetFolders, known, subdir, subpath } from '../../src/lib/dirs';
import { patiently } from '../../src/lib/files';

// A folder that counts its look-ups by name.
function folder(name: string, counts: Record<string, number> = {}): FileSystemDirectoryHandle {
  const inside = new Map<string, FileSystemDirectoryHandle>();
  return {
    name,
    kind: 'directory',
    async getDirectoryHandle(child: string, { create = false } = {}) {
      counts[child] = (counts[child] ?? 0) + 1;
      if (!inside.has(child)) {
        if (!create) throw new DOMException('none', 'NotFoundError');
        inside.set(child, folder(child, counts));
      }
      return inside.get(child)!;
    },
  } as unknown as FileSystemDirectoryHandle;
}

describe('folders kept for the visit (PF-17)', () => {
  it('looks a folder up by name once, then keeps it', async () => {
    const counts = {};
    const root = folder('root', counts);
    const a = await subpath(root, ['Episode 1', '.studio', 'versions'], true);
    expect(await subpath(root, ['Episode 1', '.studio', 'versions'])).toBe(a);
    expect(await subdir(await subdir(root, 'Episode 1'), '.studio')).toBe(await subpath(root, ['Episode 1', '.studio']));
    expect(counts).toEqual({ 'Episode 1': 1, '.studio': 1, versions: 1 });
  });

  it("doesn't remember a folder that isn't there", async () => {
    const counts: Record<string, number> = {};
    const root = folder('root', counts);
    await expect(subdir(root, 'voice')).rejects.toThrow();
    await expect(subdir(root, 'voice')).rejects.toThrow();
    const voice = await subdir(root, 'voice', true);
    expect(await subdir(root, 'voice')).toBe(voice);
    expect(counts.voice).toBe(3);
  });

  it('makes one call for look-ups at once', async () => {
    const counts: Record<string, number> = {};
    const root = folder('root', counts);
    await subdir(root, '.studio', true);
    forgetFolders();
    const [a, b, c] = await Promise.all([subdir(root, '.studio'), subdir(root, '.studio'), subpath(root, ['.studio'])]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(counts['.studio']).toBe(2);
  });

  it('makes a folder asked for with create while a look-up without it is under way', async () => {
    const root = folder('root');
    const [missing, made] = await Promise.allSettled([subdir(root, 'voice'), subdir(root, 'voice', true)]);
    expect(missing.status).toBe('rejected');
    expect(made.status).toBe('fulfilled');
    expect(await subdir(root, 'voice')).toBe((made as PromiseFulfilledResult<FileSystemDirectoryHandle>).value);
  });

  it('looks again after forgetFolders, and after a failed try in patiently', async () => {
    const counts: Record<string, number> = {};
    const root = folder('root', counts);
    await subdir(root, '.studio', true);
    forgetFolders();
    await subdir(root, '.studio');
    expect(counts['.studio']).toBe(2);
    let tries = 0;
    await patiently(async () => { if (tries++ === 0) throw new Error('busy'); }, [0]);
    await subdir(root, '.studio');
    expect(counts['.studio']).toBe(3);
  });

  it('keeps a listed folder, so what was found inside it is kept across listings', async () => {
    const counts: Record<string, number> = {};
    const root = folder('root', counts);
    const first = await known(root, folder('Episode 2', counts));
    const studio = await subdir(first, '.studio', true);
    const again = await known(root, folder('Episode 2', counts)); // a new handle from the next listing
    expect(again).toBe(first);
    expect(await subdir(again, '.studio')).toBe(studio);
    expect(counts['.studio']).toBe(1);
  });
});
