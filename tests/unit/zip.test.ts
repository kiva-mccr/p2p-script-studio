import { describe, expect, it } from 'vitest';
import { crc32 as nodeCrc } from 'node:zlib';
import { crc32, zip } from '../../src/lib/zip';

describe('zip', () => {
  it('stores each file with its UTF-8 name, size and checksum, and a central directory that finds them', async () => {
    const files = [{ name: 'Léa’s script.xml', data: new TextEncoder().encode('<xmeml/>') }, { name: 'media/a.png', data: new Uint8Array([1, 2, 3, 4]) }];
    const bytes = new Uint8Array(await zip(files, new Date(2026, 10, 14, 15, 30)).arrayBuffer());
    const v = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);
    let at = v.getUint32(end + 16, true);
    for (const file of files) {
      expect(v.getUint32(at, true)).toBe(0x02014b50);
      expect(v.getUint16(at + 8, true) & 0x0800).toBe(0x0800);
      expect(v.getUint32(at + 16, true)).toBe(nodeCrc(file.data));
      const nameLength = v.getUint16(at + 28, true);
      expect(new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength))).toBe(file.name);
      const local = v.getUint32(at + 42, true);
      expect(v.getUint32(local, true)).toBe(0x04034b50);
      const start = local + 30 + v.getUint16(local + 26, true);
      expect([...bytes.subarray(start, start + file.data.length)]).toEqual([...file.data]);
      at += 46 + nameLength;
    }
  });

  it('checksums like zlib', () => {
    const data = new TextEncoder().encode('The quick brown fox');
    expect(crc32(data)).toBe(nodeCrc(data));
  });
});
