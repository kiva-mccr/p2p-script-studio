// A .zip made in the browser (EX-19), with no library: every file stored as it is (no compression), which is what
// the media in it (JPEG, PNG, WAV, video) needs anyway. Names are UTF-8.

export type ZipEntry = { name: string; data: Uint8Array };

export function zip(entries: ZipEntry[], when = new Date()): Blob {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  const time = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const date = ((Math.max(1980, when.getFullYear()) - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  let offset = 0;
  for (const { name, data } of entries) {
    const bytes = new TextEncoder().encode(name);
    const crc = crc32(data);
    // The local header, then the data.
    const local = header(30, bytes);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    fields(l, 4, crc, data.length, bytes.length, time, date);
    parts.push(local, data as Uint8Array<ArrayBuffer>);
    // Its entry in the central directory at the end.
    const entry = header(46, bytes);
    const c = new DataView(entry.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true); // made by: version 2.0
    fields(c, 6, crc, data.length, bytes.length, time, date);
    c.setUint32(42, offset, true);
    central.push(entry);
    offset += local.length + data.length;
  }
  const size = central.reduce((n, e) => n + e.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, size, true);
  e.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

// A header of `size` bytes with the name after it.
function header(size: number, name: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(size + name.length);
  out.set(name, size);
  return out;
}

// The fields local and central headers share, from "version needed" on: stored, UTF-8 names (flag bit 11).
function fields(v: DataView, at: number, crc: number, length: number, nameLength: number, time: number, date: number) {
  v.setUint16(at, 20, true); // version needed: 2.0
  v.setUint16(at + 2, 0x0800, true); // names are UTF-8
  v.setUint16(at + 4, 0, true); // stored
  v.setUint16(at + 6, time, true);
  v.setUint16(at + 8, date, true);
  v.setUint32(at + 10, crc, true);
  v.setUint32(at + 14, length, true);
  v.setUint32(at + 18, length, true);
  v.setUint16(at + 22, nameLength, true);
}

let table: Uint32Array | null = null;
export function crc32(data: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
