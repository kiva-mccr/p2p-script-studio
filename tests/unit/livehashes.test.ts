import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fetched, hashList, HASHES_FILE, modelProblems, readHashList } from '../../src/lib/livehashes';
import type { ModelsLock } from '../../src/lib/modelfiles';
import { hashDir } from '../../scripts/hashes';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

describe("the live files' fingerprints (SE-7)", () => {
  it('lists every file under the folder with its SHA-256, paths with / from the root, leaving out an old list', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hashes-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), 'abc');
    writeFileSync(join(dir, 'assets', 'app.js'), '');
    writeFileSync(join(dir, HASHES_FILE), 'old');
    expect(hashDir(dir)).toEqual({
      'index.html': 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', // sha256("abc")
      'assets/app.js': 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // sha256("")
    });
  });

  it("writes sha256sum's format, sorted by path, and reads it back", () => {
    const text = hashList({ 'index.html': B, 'assets/app.js': A });
    expect(text).toBe(`${A}  assets/app.js\n${B}  index.html\n`);
    expect(readHashList(text)).toEqual({ 'assets/app.js': A, 'index.html': B });
    expect(readHashList(`${A} *binary mode.bin\nnot a line\n`)).toEqual({ 'binary mode.bin': A });
  });

  it('checks the speech models against their pins instead of downloading them', () => {
    const lock: ModelsLock = { 'org/model': { revision: 'r1', files: { 'config.json': { sha256: A, bytes: 3 }, 'onnx/m.onnx': { sha256: B, bytes: 9 } } } };
    const files = { 'index.html': A, 'models/r1/org/model/config.json': A, 'models/r1/org/model/onnx/m.onnx': B };
    expect(modelProblems(files, lock)).toEqual([]);
    expect(fetched(files)).toEqual(['index.html']);
    expect(modelProblems({ 'models/r1/org/model/config.json': B }, lock)).toEqual([
      'org/model/config.json is listed with another hash',
      'org/model/onnx/m.onnx is not listed',
    ]);
  });
});
