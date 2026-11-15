// The .zip for Resolve and Premiere (EX-19, board 68): the plan's media made in the browser (files copied, .svg drawn
// as PNG, cards and collages drawn, takes turned into WAV), measured for the XML, and zipped with the .xml beside them.

import { assetFile } from './folder';
import { toSrt, toXml, type EditHow, type Info, type Plan, type Source } from './editxml';
import { cleaned, decoder, readTake, wav } from './voiceexport';
import { zip, type ZipEntry } from './zip';
import { eachAtOnce } from './atonce';
import { subdir } from './dirs';

const RATE = 48000;

// Makes the zip. `missing` lists the files that couldn't be read: the editor sees those clips offline.
export async function editZip(dir: FileSystemDirectoryHandle, p: Plan, title: string, name: string, how: EditHow): Promise<{ zip: Blob; missing: string[] }> {
  const [width, height] = how.size.split('x').map(Number);
  const entries: ZipEntry[] = [];
  const info: Record<string, Info> = {};
  const missing: string[] = [];
  const decode = decoder(RATE);
  // Eight files made at a time (PF-10), each reading its own file from the drive; the zip keeps the plan's order.
  const made = await eachAtOnce([...p.media], ([, source]) => make(dir, source, width, height, decode).catch(() => null));
  [...p.media].forEach(([file, source], i) => {
    const m = made[i];
    if (!m) return void missing.push('path' in source ? source.path : file);
    entries.push({ name: `media/${file}`, data: m.data });
    info[file] = m.info;
  });
  const text = new TextEncoder();
  const top: ZipEntry[] = [{ name: `${name}.xml`, data: text.encode(toXml(p, title, how, info)) }];
  if (p.captions.length) top.push({ name: `${name}.srt`, data: text.encode(toSrt(p.captions)) });
  return { zip: zip([...top, ...entries]), missing };
}

type Made = { data: Uint8Array; info: Info };

async function make(dir: FileSystemDirectoryHandle, source: Source, width: number, height: number, decode: (data: ArrayBuffer) => Promise<Float32Array>): Promise<Made | null> {
  const frame = { width, height };
  switch (source.kind) {
    case 'copy': {
      const file = await assetFile(dir, source.path);
      if (!file) return null;
      const data = new Uint8Array(await file.arrayBuffer());
      if (source.video) {
        const v = await openVideo(file).catch(() => null);
        const info = v ? { width: v.videoWidth, height: v.videoHeight, seconds: v.duration } : {};
        if (v) free(v);
        return { data, info };
      }
      const bitmap = await createImageBitmap(file).catch(() => null);
      const info = bitmap ? { width: bitmap.width, height: bitmap.height } : {};
      bitmap?.close();
      return { data, info };
    }
    case 'png': {
      const file = await assetFile(dir, source.path);
      if (!file) return null;
      return { data: await draw(width, height, '#ffffff', async (g) => fit(g, await loadImage(file), 0, 0, width, height)), info: frame };
    }
    case 'card':
      return { data: await draw(width, height, '#e9e9e9', (g) => card(g, source.text, width, height)), info: frame };
    case 'collage': {
      const pictures = await Promise.all(source.paths.map(async (path) => {
        const file = await assetFile(dir, path);
        return file ? await picture(file, path, false).catch(() => null) : null;
      }));
      const each = width / pictures.length;
      const data = await draw(width, height, '#000000', (g) => pictures.forEach((pic, i) => pic && fit(g, pic, i * each, 0, each, height)));
      pictures.forEach((pic) => pic && free(pic));
      return { data, info: frame };
    }
    case 'last': {
      const file = await assetFile(dir, source.path);
      if (!file) return null;
      const pic = await picture(file, source.path, true);
      const data = await draw(width, height, '#000000', (g) => fit(g, pic, 0, 0, width, height));
      free(pic);
      return { data, info: frame };
    }
    case 'take': {
      let voice: FileSystemDirectoryHandle;
      try {
        voice = await subdir(dir, 'voice');
      } catch {
        return null;
      }
      const file = await (await voice.getFileHandle(`row-${source.id}.webm`)).getFile();
      const samples = cleaned(await decode(await file.arrayBuffer()), await readTake(voice, source.id), RATE);
      return { data: wav(samples, RATE), info: { seconds: samples.length / RATE } };
    }
  }
}

type Drawable = HTMLImageElement | HTMLVideoElement | ImageBitmap;
const sizeOf = (d: Drawable) => (d instanceof HTMLVideoElement ? { w: d.videoWidth, h: d.videoHeight } : { w: d.width, h: d.height });

// A picture to draw: an image, or a video's first (or last) frame.
async function picture(file: File, path: string, lastFrame: boolean): Promise<Drawable> {
  if (!/\.(mp4|webm|mov|m4v)$/i.test(path)) return loadImage(file);
  const v = await openVideo(file);
  await new Promise<void>((done, fail) => {
    v.onseeked = () => done();
    v.onerror = () => fail(new Error('video'));
    v.currentTime = lastFrame ? Math.max(0, v.duration - 0.05) : 0.01;
  });
  return v;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  return new Promise<HTMLImageElement>((done, fail) => {
    img.onload = () => done(img);
    img.onerror = () => fail(new Error('image'));
    img.src = url;
  }).finally(() => setTimeout(() => URL.revokeObjectURL(url), 0));
}

// A video's object URL is freed once its frame is drawn (an image's is freed as soon as it has loaded).
function free(d: Drawable) {
  if (d instanceof HTMLVideoElement) URL.revokeObjectURL(d.src);
}

function openVideo(file: Blob): Promise<HTMLVideoElement> {
  const v = document.createElement('video');
  v.muted = true;
  v.preload = 'auto';
  v.src = URL.createObjectURL(file);
  return new Promise((done, fail) => {
    v.onloadeddata = () => done(v);
    v.onerror = () => fail(new Error('video'));
  });
}

// A PNG of the frame's size, on `ground`.
async function draw(width: number, height: number, ground: string, paint: (g: CanvasRenderingContext2D) => void | Promise<void>): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d')!;
  g.fillStyle = ground;
  g.fillRect(0, 0, width, height);
  await paint(g);
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/png'));
  if (!blob) throw new Error('png');
  return new Uint8Array(await blob.arrayBuffer());
}

// The picture as large as fits in the box, centred.
function fit(g: CanvasRenderingContext2D, d: Drawable, x: number, y: number, w: number, h: number) {
  const { w: dw, h: dh } = sizeOf(d);
  if (!dw || !dh) return;
  const s = Math.min(w / dw, h / dh);
  g.drawImage(d, x + (w - dw * s) / 2, y + (h - dh * s) / 2, dw * s, dh * s);
}

// Words on a grey card, wrapped and centred, like the timeline's cards.
function card(g: CanvasRenderingContext2D, text: string, width: number, height: number) {
  const size = Math.round(Math.min(width, height) / 16);
  g.fillStyle = '#3d3d3d';
  g.font = `${size}px Inter, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const room = width * 0.8;
  const lines: string[] = [];
  for (const word of text.split(/\s+/)) {
    const line = lines.length ? `${lines[lines.length - 1]} ${word}` : word;
    if (lines.length && g.measureText(line).width <= room) lines[lines.length - 1] = line;
    else lines.push(word);
  }
  const shown = lines.slice(0, 8);
  shown.forEach((line, i) => g.fillText(line, width / 2, height / 2 + (i - (shown.length - 1) / 2) * size * 1.3));
}
