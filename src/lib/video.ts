// The storyboard timeline as a video (SB-3, board 70): the plan EX-19 makes for Resolve and Premiere (lib/editxml.ts),
// drawn frame by frame on a canvas with the takes underneath, and encoded in the browser (WebCodecs, packed by
// mediabunny). MP4 (H.264) where the computer can make it, else WebM. `frame` draws one moment for the preview,
// with the same code as the file.

import type { Fps, Plan, Source, Item } from './editxml';
import { OWN, frameRate, readFps, readSide, type Own } from './framing';
import { assetFile } from './folder';
import { card, collage, fit, free, loadImage, picture, type Drawable } from './editmedia';
import { cleaned, decoder, readTake } from './voiceexport';
import { subdir } from './dirs';
import type { Shape } from './timeline';

export type VideoSize = '720' | '1080';
// The video's settings: its size (its shape comes from the script, unless a size of your own is set, #217) and frame
// rate (30 unless chosen), captions, rows with no take, videos' own sound.
// `find` (#227): placeholders' cards list what their row still has to find or film.
export type VideoHow = { size: VideoSize | 'custom'; fps: Fps | 'custom'; captions: boolean; skip: boolean; sound: boolean; find: boolean } & Own;
export const VIDEO: VideoHow = { size: '1080', fps: '30', captions: false, skip: false, sound: false, find: true, ...OWN };
const RATE = 48000;
const AUDIO_BITS = 128_000;

export function frameSize(size: VideoSize, shape: Shape): { width: number; height: number } {
  const long = size === '720' ? 1280 : 1920;
  const short = size === '720' ? 720 : 1080;
  return shape === 'upright' ? { width: short, height: long } : { width: long, height: short };
}
// The video's frame: 720p or 1080p in the script's shape, or your own size, made even (H.264 needs even sides); null
// while a Custom box holds something that isn't a size.
export function videoFrame(how: VideoHow, shape: Shape): { width: number; height: number } | null {
  if (how.size !== 'custom') return frameSize(how.size, shape);
  const width = readSide(how.ownWidth);
  const height = readSide(how.ownHeight);
  return width && height ? { width: width - (width % 2), height: height - (height % 2) } : null;
}
// Frames a second, exactly (29.97 is 30000/1001), or null while the Custom box isn't a rate.
export function videoFps(how: VideoHow): number | null {
  const fps = how.fps === 'custom' ? readFps(how.ownFps) : Number(how.fps);
  return fps === null ? null : frameRate(fps).exact;
}
// Bits a second for the picture: stills and slow cuts need little. Your own size gets 1080p's, by its pixels.
export function videoBits(how: VideoHow, frame: { width: number; height: number }): number {
  if (how.size !== 'custom') return how.size === '720' ? 1_200_000 : 2_500_000;
  return Math.max(300_000, Math.round((2_500_000 * frame.width * frame.height) / (1920 * 1080) / 1000) * 1000);
}
export const megabytes = (seconds: number, bits: number) => Math.max(1, Math.round((seconds * (bits + AUDIO_BITS)) / 8 / 1e6));

const isVideo = (path: string) => /\.(mp4|webm|mov|m4v)$/i.test(path);

// The clip on the picture track at `t`, or -1 (before the first, after the last, or a gap).
export function itemAt(items: Item[], t: number): number {
  for (let i = items.length - 1; i >= 0; i--) if (items[i].start <= t + 1e-6) return t < items[i].start + items[i].seconds - 1e-6 ? i : -1;
  return -1;
}

// The caption on screen at `t`: the dialogue of the row playing.
export function captionAt(p: Plan, t: number): string {
  return p.captions.find((c) => c.start <= t + 1e-6 && t < c.start + c.seconds - 1e-6)?.text ?? '';
}

// The caption's lines, wrapped to `room` pixels, at most three (the last cut with …).
export function wrap(text: string, room: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const line = lines.length ? `${lines[lines.length - 1]} ${word}` : word;
    if (lines.length && measure(line) <= room) lines[lines.length - 1] = line;
    else lines.push(word);
  }
  if (lines.length > 3) return [...lines.slice(0, 2), `${lines[2]}…`];
  return lines;
}

// What a clip shows, ready to draw: pictures (one, or a collage's), a card, or a video playing.
type Ready =
  | { kind: 'pics'; pics: (Drawable | null)[]; collage: boolean }
  | { kind: 'card'; text: string; find?: string[] }
  | { kind: 'video'; next: (local: number) => Promise<CanvasImageSource | null>; done: () => void };

// Reads a clip's media from the folder. A file that can't be read is a card with its name (and named in `missing`).
async function ready(dir: FileSystemDirectoryHandle, source: Source, item: Item, playing: boolean, missing: Set<string>, fps = 30): Promise<Ready> {
  const lost = (path: string): Ready => (missing.add(path), { kind: 'card', text: path.split('/').at(-1) || path });
  const one = async (path: string, last = false) => {
    const file = await assetFile(dir, path).catch(() => null);
    if (!file) return null;
    return await (isVideo(path) ? picture(file, path, last) : loadImage(file)).catch(() => null);
  };
  switch (source.kind) {
    case 'card':
      return { kind: 'card', text: source.text, find: source.find };
    case 'collage': {
      const pics = await Promise.all(source.paths.map((path) => one(path)));
      source.paths.forEach((path, i) => !pics[i] && missing.add(path));
      return { kind: 'pics', pics, collage: true };
    }
    case 'last': {
      const pic = await one(source.path, true);
      return pic ? { kind: 'pics', pics: [pic], collage: false } : lost(source.path);
    }
    case 'png': {
      const pic = await one(source.path);
      return pic ? { kind: 'pics', pics: [pic], collage: false } : lost(source.path);
    }
    case 'copy': {
      if (source.video && playing) {
        const file = await assetFile(dir, source.path).catch(() => null);
        const video = file ? await playVideo(file, item, fps).catch(() => null) : null;
        if (video) return video;
      }
      const pic = await one(source.path);
      return pic ? { kind: 'pics', pics: [pic], collage: false } : lost(source.path);
    }
    case 'take':
      return { kind: 'card', text: '' };
  }
}

// A video's frames in order, decoded as the clip plays; past its end it stays on its last frame.
async function playVideo(file: File, item: Item, fps: number): Promise<Ready> {
  const { Input, BlobSource, ALL_FORMATS, CanvasSink } = await import('mediabunny');
  const input = new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track || !(await track.canDecode())) {
    input.dispose();
    throw new Error('video');
  }
  const end = Math.max(0, (await track.computeDuration()) - 0.001);
  const sink = new CanvasSink(track, { poolSize: 2 });
  const count = Math.ceil(item.seconds * fps);
  const times = function* () {
    for (let f = 0; f < count; f++) yield Math.min(f / fps, end);
  };
  const frames = sink.canvasesAtTimestamps(times());
  let last: CanvasImageSource | null = null;
  return {
    kind: 'video',
    async next() {
      const step = await frames.next();
      if (!step.done && step.value) last = step.value.canvas as CanvasImageSource;
      return last;
    },
    done() {
      void frames.return(undefined);
      input.dispose();
    },
  };
}

// Draws one frame: the clip's picture fitted on black (a card on grey), then the caption.
function paint(g: CanvasRenderingContext2D, width: number, height: number, look: Ready | null, shot: CanvasImageSource | null, caption: string) {
  g.fillStyle = look?.kind === 'card' ? '#e9e9e9' : '#000000';
  g.fillRect(0, 0, width, height);
  if (look?.kind === 'card') card(g, look.text, width, height, look.find);
  else if (look?.kind === 'pics') look.collage ? collage(g, look.pics, width, height) : look.pics[0] && fit(g, look.pics[0], 0, 0, width, height);
  else if (shot) fit(g, shot as Drawable, 0, 0, width, height);
  if (caption) drawCaption(g, caption, width, height);
}

// The dialogue at the foot of the frame, white on a dark band, like a video player's captions.
function drawCaption(g: CanvasRenderingContext2D, text: string, width: number, height: number) {
  const size = Math.round(Math.min(width, height) / 22);
  g.font = `500 ${size}px Inter, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lines = wrap(text, width * 0.84, (s) => g.measureText(s).width);
  const step = size * 1.35;
  const bottom = height - Math.round(Math.min(width, height) * 0.07);
  lines.forEach((line, i) => {
    const y = bottom - (lines.length - 1 - i) * step - step / 2;
    const w = g.measureText(line).width + size;
    g.fillStyle = 'rgba(0, 0, 0, 0.72)';
    g.fillRect(width / 2 - w / 2, y - step / 2, w, step);
    g.fillStyle = '#ffffff';
    g.fillText(line, width / 2, y);
  });
}

// One moment for the preview, drawn as the video draws it (a video clip shows its first frame).
export async function frame(dir: FileSystemDirectoryHandle, p: Plan, t: number, canvas: HTMLCanvasElement): Promise<void> {
  const items = p.video[0] ?? [];
  const i = itemAt(items, t);
  const look = i >= 0 ? await ready(dir, p.media.get(items[i].name)!, items[i], false, new Set()) : null;
  const g = canvas.getContext('2d')!;
  paint(g, canvas.width, canvas.height, look, null, captionAt(p, t));
  if (look?.kind === 'pics') look.pics.forEach((pic) => pic && free(pic));
}

// The voice-over (and, if asked, the videos' own sound, quieter) on one mono track as long as the video.
async function mix(dir: FileSystemDirectoryHandle, p: Plan, sound: boolean): Promise<Float32Array<ArrayBuffer>> {
  const out = new Float32Array(Math.ceil(p.total * RATE));
  const decode = decoder(RATE);
  const put = (samples: Float32Array, start: number, seconds: number, gain: number) => {
    const at = Math.round(start * RATE);
    const n = Math.min(samples.length, Math.round(seconds * RATE), out.length - at);
    for (let i = 0; i < n; i++) out[at + i] += samples[i] * gain;
  };
  let voice: FileSystemDirectoryHandle | null = null;
  for (const item of p.audio) {
    const source = p.media.get(item.name);
    if (source?.kind !== 'take') continue;
    try {
      voice ??= await subdir(dir, 'voice');
      const file = await (await voice.getFileHandle(`row-${source.id}.webm`)).getFile();
      put(cleaned(await decode(await file.arrayBuffer()), await readTake(voice, source.id), RATE), item.start, item.seconds, 1);
    } catch {
      // A take that can't be read is silent: its row still plays for its time.
    }
  }
  if (sound) {
    for (const item of p.video[0] ?? []) {
      const source = p.media.get(item.name);
      if (source?.kind !== 'copy' || !source.video) continue;
      try {
        const file = await assetFile(dir, source.path);
        if (file) put(await decode(await file.arrayBuffer()), item.start, item.seconds, 0.5);
      } catch {
        // No sound in it, or one the browser can't read.
      }
    }
  }
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
  return out;
}

// The format this computer can make: MP4 (H.264, with AAC or Opus) first, else WebM (VP9 or VP8, Opus).
async function pickFormat(width: number, height: number, bitrate: number) {
  const m = await import('mediabunny');
  const audioOk = async (codecs: ('aac' | 'opus')[]) => m.getFirstEncodableAudioCodec(codecs, { numberOfChannels: 1, sampleRate: RATE, bitrate: AUDIO_BITS });
  if (await m.canEncodeVideo('avc', { width, height, bitrate })) {
    const audio = await audioOk(['aac', 'opus']);
    if (audio) return { mp4: true, video: 'avc' as const, audio, format: new m.Mp4OutputFormat({ fastStart: 'in-memory' }) };
  }
  const video = await m.getFirstEncodableVideoCodec(['vp9', 'vp8'], { width, height, bitrate });
  const audio = await audioOk(['opus']);
  if (!video || !audio) return null;
  return { mp4: false, video, audio, format: new m.WebMOutputFormat() };
}

export type Made = { video: Blob; mp4: boolean; missing: string[] };

// Makes the video. `progress` gets 0 to 1; `stopped` is asked between frames and ends it with null.
export async function makeVideo(dir: FileSystemDirectoryHandle, p: Plan, how: VideoHow, shape: Shape,
  progress: (done: number) => void, stopped: () => boolean): Promise<Made | null> {
  const m = await import('mediabunny');
  const size = videoFrame(how, shape);
  const fps = videoFps(how);
  if (!size || !fps) throw new Error('The frame size or rate is not one the video can be made at.');
  const { width, height } = size;
  const bitrate = videoBits(how, size);
  const kind = await pickFormat(width, height, bitrate);
  if (!kind) throw new Error("This browser can't make a video (no WebCodecs encoder for MP4 or WebM).");
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d', { alpha: false })!;
  const output = new m.Output({ format: kind.format, target: new m.BufferTarget() });
  const picture = new m.CanvasSource(canvas, { codec: kind.video, bitrate, keyFrameInterval: 2 });
  const sound = new m.AudioBufferSource({ codec: kind.audio, bitrate: AUDIO_BITS });
  output.addVideoTrack(picture, { frameRate: fps });
  output.addAudioTrack(sound);
  const missing = new Set<string>();
  const items = p.video[0] ?? [];
  const samples = await mix(dir, p, how.sound);
  await output.start();
  const frames = Math.max(1, Math.round(p.total * fps));
  let current = -1;
  let look: Ready | null = null;
  const letGo = () => {
    if (look?.kind === 'video') look.done();
    if (look?.kind === 'pics') look.pics.forEach((pic) => pic && free(pic));
    look = null;
  };
  let sent = 0; // seconds of sound given to the encoder, kept about a second ahead of the picture
  try {
    for (let f = 0; f < frames; f++) {
      if (stopped()) {
        await output.cancel();
        return null;
      }
      const t = f / fps;
      const i = itemAt(items, t);
      if (i !== current) {
        letGo();
        current = i;
        if (i >= 0) look = await ready(dir, p.media.get(items[i].name)!, items[i], true, missing, fps);
      }
      const shot = look?.kind === 'video' ? await look.next(t - items[i].start) : null;
      paint(g, width, height, look, shot, captionAt(p, t));
      await picture.add(t, 1 / fps);
      while (sent < Math.min(p.total, t + 1)) {
        const from = Math.round(sent * RATE);
        const to = Math.min(samples.length, from + RATE);
        if (to <= from) break;
        const buffer = new AudioBuffer({ length: to - from, numberOfChannels: 1, sampleRate: RATE });
        buffer.copyToChannel(samples.subarray(from, to), 0);
        await sound.add(buffer);
        sent = to / RATE;
      }
      if (f % 15 === 0) progress(f / frames);
    }
    letGo();
    await output.finalize();
  } catch (e) {
    letGo();
    if (output.state !== 'canceled' && output.state !== 'finalized') await output.cancel().catch(() => {});
    throw e;
  }
  progress(1);
  const buffer = (output.target as InstanceType<typeof m.BufferTarget>).buffer!;
  return { video: new Blob([buffer], { type: kind.mp4 ? 'video/mp4' : 'video/webm' }), mp4: kind.mp4, missing: [...missing] };
}
