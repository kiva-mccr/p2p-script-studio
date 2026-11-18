// The storyboard timeline (SB-1) for DaVinci Resolve and Adobe Premiere Pro (EX-19, board 68): what goes on which
// track (`plan`), written as Final Cut Pro 7 XML (`toXml`), which both import, and the dialogue as captions
// (`toSrt`). Only reads the script and the timeline's layout; the media files themselves are made by lib/editmedia.ts.

import { clearMarks } from './format';
import { readFileRef, rows, type Script } from './script';
import type { Lane, TimeBlock } from './timeline';

export type FrameSize = '1920x1080' | '3840x2160' | '1080x1920';
export type Fps = '24' | '25' | '29.97' | '30';
// The export's settings: frame size and rate, collages as one picture or one track per picture, markers, captions.
export type EditHow = { size: FrameSize; fps: Fps; stacked: boolean; markers: boolean; captions: boolean };
export const EDIT: EditHow = { size: '1920x1080', fps: '30', stacked: false, markers: true, captions: false };
export const SIZES: { id: FrameSize; name: string }[] = [
  { id: '1920x1080', name: '1920 × 1080 (HD)' },
  { id: '3840x2160', name: '3840 × 2160 (4K)' },
  { id: '1080x1920', name: '1080 × 1920 (upright)' },
];
export const RATES: Fps[] = ['24', '25', '29.97', '30'];

// Where a file in the zip's media folder comes from.
export type Source =
  | { kind: 'copy'; path: string; video: boolean } // a picture or video from the script's folder, as it is
  | { kind: 'png'; path: string } // an .svg, drawn as a PNG (neither app opens .svg)
  | { kind: 'card'; text: string } // a grey card with words: a placeholder, or a row with no pictures
  | { kind: 'collage'; paths: string[] } // a collage's pictures side by side, as one picture
  | { kind: 'last'; path: string } // a video's last frame, for a hold after it
  | { kind: 'take'; id: string }; // a row's voice-over take, as WAV

export type Item = { name: string; start: number; seconds: number }; // one clip on a track: a media file's name, in seconds
export type Marker = { start: number; name: string; comment: string };
export type Caption = { start: number; seconds: number; text: string };
export type Link = { row: number; label: string; target: string };
export type Section = { start: number; seconds: number; title: string; row: number }; // a named section's span, for the preview
export type Plan = {
  total: number;
  video: Item[][]; // V1 first
  audio: Item[]; // A1: the takes
  markers: Marker[];
  sections: Section[]; // the named sections the markers carry: only for the preview's Sections row, not in the XML
  captions: Caption[];
  media: Map<string, Source>; // by file name in the media folder
  links: Link[]; // files given as links: not in the zip, named in their row's marker
};

const SVG = /\.svg$/i;
const base = (path: string) => path.split('/').at(-1) || path;
const plainText = (text: string) => clearMarks(text).replace(/\s+/g, ' ').trim();

// What goes where. `laid` is the timeline's `layout` of the script (the same timings as under the script).
export function plan(script: Script, laid: { blocks: TimeBlock[]; lanes: Lane[]; total: number }, how: EditHow): Plan {
  const all = rows(script);
  const number = new Map(all.map((r, i) => [r.id, i + 1]));
  const byId = new Map(all.map((r) => [r.id, r]));
  const firstOf = new Map(laid.lanes.filter((l) => l.first).map((l) => [l.first, l.title]));
  const media = new Map<string, Source>();
  const keys = new Map<string, string>();
  const video: Item[][] = [[]];
  const audio: Item[] = [];
  const markers: Marker[] = [];
  const captions: Caption[] = [];
  const links: Link[] = [];

  // A file in the media folder for `source`: the same source is one file, and two files never share a name.
  function file(name: string, source: Source): string {
    const key = JSON.stringify(source);
    const known = keys.get(key);
    if (known) return known;
    let unique = name;
    for (let n = 2; media.has(unique); n++) unique = name.replace(/(\.[^.]+)?$/, `-${n}$1`);
    media.set(unique, source);
    keys.set(key, unique);
    return unique;
  }
  const picture = (path: string, isVideo: boolean): string =>
    SVG.test(path) ? file(base(path).replace(SVG, '.png'), { kind: 'png', path }) : file(base(path), { kind: 'copy', path, video: isVideo });
  const put = (track: number, item: Item) => {
    while (video.length <= track) video.push([]);
    video[track].push(item);
    return { track, item };
  };

  let last: { track: number; item: Item }[] = []; // what is on screen as the previous block ends
  for (const b of laid.blocks) {
    if (b.kind === 'row') {
      const row = byId.get(b.id)!;
      const n = number.get(b.id)!;
      const isVideo = (path: string) => /\.(mp4|webm|mov|m4v)$/i.test(path);
      if (!b.picks.length) {
        last = [put(0, { name: file(`card-row-${n}.png`, { kind: 'card', text: plainText(row.onScreen) || `Row ${n}` }), start: b.start, seconds: b.seconds })];
      } else if (b.collage && !how.stacked) {
        last = [put(0, { name: file(`row-${n}-collage.png`, { kind: 'collage', paths: b.picks }), start: b.start, seconds: b.seconds })];
      } else if (b.collage) {
        last = b.picks.map((path, i) => put(i, { name: picture(path, isVideo(path)), start: b.start, seconds: b.seconds }));
      } else {
        const shots = b.shots.map((s) => put(0, { name: picture(s.path, isVideo(s.path)), start: b.start + s.start, seconds: s.seconds }));
        last = shots.slice(-1);
      }
      if (b.take) audio.push({ name: file(`take-${n}.wav`, { kind: 'take', id: b.id }), start: b.start, seconds: b.seconds });
      const text = plainText(row.dialogue);
      if (text && how.captions) captions.push({ start: b.start, seconds: b.seconds, text });
      const linked = row.files.map(readFileRef).filter((f) => f.kind === 'link');
      for (const l of linked) links.push({ row: n, label: l.label, target: l.target });
      if (how.markers) {
        const section = firstOf.get(b.id);
        const notIn = linked.map((l) => (l.label === l.target ? l.target : `${l.label} (${l.target})`));
        markers.push({ start: b.start, name: `Row ${n}${section ? ` · ${section}` : ''}`, comment: [text, ...notIn.map((l) => `Not in the zip: ${l}`)].filter(Boolean).join('\n') });
      }
    } else if (b.kind === 'hold') {
      // The picture before stays on screen: a still is held longer; a video holds on its last frame.
      if (!last.length) last = [put(0, { name: file('card-hold.png', { kind: 'card', text: 'Hold' }), start: b.start, seconds: 0 })];
      last = last.map(({ track, item }) => {
        const source = media.get(item.name)!;
        if (item.start + item.seconds < b.start - 0.001) return put(track, { ...item, start: b.start, seconds: b.seconds });
        if (source.kind === 'copy' && source.video) {
          return put(track, { name: file(base(source.path).replace(/\.[^.]+$/, '-last-frame.png'), { kind: 'last', path: source.path }), start: b.start, seconds: b.seconds });
        }
        item.seconds += b.seconds;
        return { track, item };
      });
    } else {
      const n = number.get(b.after) ?? 0;
      last = [put(0, { name: file(`card-placeholder-${n}.png`, { kind: 'card', text: b.label.trim() || 'Placeholder' }), start: b.start, seconds: b.seconds })];
    }
  }
  const sections = how.markers ? laid.lanes.filter((l) => l.title && l.seconds > 0).map((l) => ({ start: l.start, seconds: l.seconds, title: l.title, row: number.get(l.first) ?? 0 })) : [];
  return { total: laid.total, video, audio, markers, sections, captions, media, links };
}

// What each media file turned out to be, once made: its size in pixels, and its length for a video or a take.
export type Info = { width?: number; height?: number; seconds?: number };

// Final Cut Pro 7 XML ("xmeml"), which Resolve (File › Import › Timeline) and Premiere (File › Import) both open.
// Paths are relative to the .xml, in its media folder.
export function toXml(p: Plan, title: string, how: EditHow, info: Record<string, Info> = {}): string {
  const [width, height] = how.size.split('x').map(Number);
  const ntsc = how.fps === '29.97';
  const timebase = ntsc ? 30 : Number(how.fps);
  const perSecond = ntsc ? 30000 / 1001 : timebase;
  const f = (seconds: number) => Math.round(seconds * perSecond);
  const rate = `<rate><timebase>${timebase}</timebase><ntsc>${ntsc ? 'TRUE' : 'FALSE'}</ntsc></rate>`;
  const written = new Set<string>();
  let clipId = 0;
  // The longest any clip uses each file, for a still's length.
  const longest = new Map<string, number>();
  for (const item of [...p.video.flat(), ...p.audio]) longest.set(item.name, Math.max(longest.get(item.name) ?? 0, f(item.start + item.seconds) - f(item.start)));

  const fileXml = (name: string, kind: 'video' | 'audio'): string => {
    const id = `file-${[...p.media.keys()].indexOf(name) + 1}`;
    if (written.has(id)) return `<file id="${id}"/>`;
    written.add(id);
    const about = info[name] ?? {};
    const length = about.seconds ? f(about.seconds) : (longest.get(name) ?? 0);
    const mediaXml = kind === 'audio'
      ? `<media><audio><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics><channelcount>1</channelcount></audio></media>`
      : `<media><video><samplecharacteristics>${rate}${about.width ? `<width>${about.width}</width><height>${about.height}</height>` : ''}</samplecharacteristics></video></media>`;
    return `<file id="${id}"><name>${esc(name)}</name><pathurl>${esc(`media/${encodeURI(name)}`)}</pathurl>${rate}<duration>${length}</duration>${mediaXml}</file>`;
  };

  const clipXml = (item: Item, kind: 'video' | 'audio'): string => {
    const source = p.media.get(item.name)!;
    const moving = (source.kind === 'copy' && source.video) || source.kind === 'take';
    const start = f(item.start);
    let end = f(item.start + item.seconds);
    const about = info[item.name] ?? {};
    if (moving && about.seconds) end = Math.min(end, start + f(about.seconds)); // a video or take shorter than its turn ends early
    const length = end - start;
    const duration = moving && about.seconds ? f(about.seconds) : (longest.get(item.name) ?? length);
    // Pictures bigger or smaller than the frame are scaled to fit it (Basic Motion), as the timeline shows them.
    const scale = kind === 'video' && about.width && about.height ? Math.min(width / about.width, height / about.height) * 100 : 100;
    const motion = Math.abs(scale - 100) > 0.01
      ? `<filter><effect><name>Basic Motion</name><effectid>basic</effectid><effectcategory>motion</effectcategory><effecttype>motion</effecttype><mediatype>video</mediatype><parameter><parameterid>scale</parameterid><name>Scale</name><valuemin>0</valuemin><valuemax>1000</valuemax><value>${round(scale)}</value></parameter></effect></filter>`
      : '';
    const still = kind === 'video' && !moving ? '<stillframe>TRUE</stillframe>' : '';
    const track = kind === 'audio' ? '<sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>' : '';
    return `<clipitem id="clipitem-${++clipId}"><name>${esc(item.name)}</name><enabled>TRUE</enabled><duration>${duration}</duration>${rate}<start>${start}</start><end>${end}</end><in>0</in><out>${length}</out>${still}${fileXml(item.name, kind)}${track}${motion}</clipitem>`;
  };

  const tracks = p.video.map((items) => `<track>${items.map((i) => clipXml(i, 'video')).join('')}</track>`).join('');
  const markers = p.markers.map((m) => `<marker><name>${esc(m.name)}</name><comment>${esc(m.comment)}</comment><in>${f(m.start)}</in><out>-1</out></marker>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
<sequence id="sequence-1">
<name>${esc(title)}</name>
<duration>${f(p.total)}</duration>
${rate}
<media>
<video><format><samplecharacteristics>${rate}<width>${width}</width><height>${height}</height><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance></samplecharacteristics></format>${tracks}</video>
<audio><track>${p.audio.map((i) => clipXml(i, 'audio')).join('')}</track></audio>
</media>
${markers}
</sequence>
</xmeml>
`;
}

// The dialogue as captions, one per row, timed like the timeline.
export function toSrt(captions: Caption[]): string {
  const time = (s: number) => {
    const ms = Math.round(s * 1000);
    const two = (n: number) => String(n).padStart(2, '0');
    return `${two(Math.floor(ms / 3600000))}:${two(Math.floor(ms / 60000) % 60)}:${two(Math.floor(ms / 1000) % 60)},${String(ms % 1000).padStart(3, '0')}`;
  };
  return captions.map((c, i) => `${i + 1}\n${time(c.start)} --> ${time(c.start + c.seconds)}\n${c.text}\n`).join('\n');
}

const round = (n: number) => Math.round(n * 100) / 100;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
