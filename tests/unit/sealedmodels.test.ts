import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { zip } from '../../src/lib/zip';
import { checkModels, zipIndex } from '../../src/lib/sealedmodels';
import { modelsTag, type ModelsLock } from '../../src/lib/modelfiles';
import lock from '../../src/lib/models.lock.json';

// The sealed app's speech models (SE-5): the zip from the deploy is read in place and checked against the lock.
const bytes = (text: string) => new TextEncoder().encode(text);
const sha = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const files = { 'org/model/config.json': bytes('{"a":1}'), 'org/model/onnx/encoder_model.onnx': bytes('weights'.repeat(1000)) };
const pinned: ModelsLock = {
  'org/model': { revision: 'abcdef0123', files: Object.fromEntries(Object.entries(files).map(([n, d]) => [n.slice(10), { sha256: sha(d), bytes: d.length }])) },
};
const made = zip(Object.entries(files).map(([name, data]) => ({ name, data })), new Date(2026, 0, 1));

describe("the speech models' zip", () => {
  it('finds every file as a slice of the zip, and passes the pinned files', async () => {
    const index = await zipIndex(made);
    expect(Object.keys(index)).toEqual(Object.keys(files));
    const [at, size] = index['org/model/config.json'];
    expect(await made.slice(at, at + size).text()).toBe('{"a":1}');
    const seen: number[] = [];
    expect(await checkModels(made, index, pinned, (done) => seen.push(done))).toEqual([]);
    expect(seen).toEqual([1, 2]);
  });

  it('names a missing file and a changed one', async () => {
    const other = zip([{ name: 'org/model/config.json', data: bytes('{"a":2}') }]);
    expect(await checkModels(other, await zipIndex(other), pinned)).toEqual([
      'org/model/config.json isn\'t the right file', 'org/model/onnx/encoder_model.onnx is missing']);
  });

  it("refuses what isn't a zip", async () => {
    await expect(zipIndex(new Blob(['not a zip at all']))).rejects.toThrow("it isn't a zip");
  });

  it('pins every model with a release tag made of their revisions, and no file over 100 MB (GitHub Pages)', () => {
    const l = lock as ModelsLock;
    expect(Object.keys(l)).toEqual(['onnx-community/moonshine-base-ONNX', 'onnx-community/whisper-base_timestamped']);
    expect(modelsTag(l)).toMatch(/^speech-models-[0-9a-f]{7}-[0-9a-f]{7}$/);
    for (const m of Object.values(l)) for (const f of Object.values(m.files)) expect(f.bytes).toBeLessThan(100e6);
  });
});
