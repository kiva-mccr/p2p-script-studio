import { describe, expect, it } from 'vitest';
import { parseScript, type Row } from '../../src/lib/script';
import { layout } from '../../src/lib/timeline';
import { EDIT, plan, toSrt, toXml, type EditHow } from '../../src/lib/editxml';

const source = `# Intro

## 1 <!-- id: aaaaa -->
Dialogue:
Every leaf is a **tiny factory**.

On screen:
Push in on a leaf.

Files:
- assets/leaf.jpg
- assets/push-in.mp4

Timeline: then hold 2 s

## 2 <!-- id: bbbbb -->
Dialogue:
Sun, water and air.

On screen:
Icons slide in.

Files:
- assets/icons.svg
- assets/sketch.png (timeline)
- [Zoom animation](https://example.com/zoom.mp4)

Timeline: collage, then placeholder 3 s "Drone shot"

# Wrap-up

## 3 <!-- id: ccccc -->
Dialogue:
And the leftover?

On screen:
A deep breath in the park.
`;

const script = parseScript(source);
// Rows 1 and 3 have takes (4 s and 2 s); row 2 reads for 5 s.
const lengths: Record<string, { seconds: number; take: boolean }> = { aaaaa: { seconds: 4, take: true }, bbbbb: { seconds: 5, take: false }, ccccc: { seconds: 2, take: true } };
const laid = layout(script, (row: Row) => lengths[row.id]);
const made = (how: Partial<EditHow> = {}) => plan(script, laid, { ...EDIT, ...how });

describe('plan', () => {
  it('lays a sequence, a hold on a video, a collage as one picture, a placeholder card and a card for a row with no pictures on V1', () => {
    const p = made();
    expect(p.total).toBe(4 + 2 + 5 + 3 + 2);
    expect(p.video).toHaveLength(1);
    expect(p.video[0]).toEqual([
      { name: 'leaf.jpg', start: 0, seconds: 2 },
      { name: 'push-in.mp4', start: 2, seconds: 2 },
      { name: 'push-in-last-frame.png', start: 4, seconds: 2 }, // a video holds on its last frame
      { name: 'row-2-collage.png', start: 6, seconds: 5 },
      { name: 'card-placeholder-2.png', start: 11, seconds: 3 },
      { name: 'card-row-3.png', start: 14, seconds: 2 },
    ]);
    expect(p.media.get('row-2-collage.png')).toEqual({ kind: 'collage', paths: ['assets/icons.svg', 'assets/sketch.png'] });
    expect(p.media.get('card-placeholder-2.png')).toEqual({ kind: 'card', text: 'Drone shot' });
    expect(p.media.get('card-row-3.png')).toEqual({ kind: 'card', text: 'A deep breath in the park.' });
  });

  it('puts only the takes on A1, and a row with no take leaves a gap there', () => {
    expect(made().audio).toEqual([{ name: 'take-1.wav', start: 0, seconds: 4 }, { name: 'take-3.wav', start: 14, seconds: 2 }]);
  });

  it('stacks a collage on its own tracks when asked, with .svg turned into .png', () => {
    const p = made({ stacked: true });
    expect(p.video).toHaveLength(2);
    expect(p.video[0][3]).toEqual({ name: 'icons.png', start: 6, seconds: 5 });
    expect(p.video[1]).toEqual([{ name: 'sketch.png', start: 6, seconds: 5 }]);
    expect(p.media.get('icons.png')).toEqual({ kind: 'png', path: 'assets/icons.svg' });
  });

  it('holds a still longer instead of adding a clip', () => {
    const s = parseScript(source.replace('- assets/push-in.mp4\n', ''));
    const p = plan(s, layout(s, (row: Row) => lengths[row.id]), EDIT);
    expect(p.video[0][0]).toEqual({ name: 'leaf.jpg', start: 0, seconds: 6 });
  });

  it('marks each row with its number, its section and its dialogue, and names links that are not in the zip', () => {
    const p = made();
    expect(p.markers.map((m) => m.name)).toEqual(['Row 1 · Intro', 'Row 2', 'Row 3 · Wrap-up']);
    expect(p.markers[0].comment).toBe('Every leaf is a tiny factory.');
    expect(p.markers[1].comment).toBe('Sun, water and air.\nNot in the zip: Zoom animation (https://example.com/zoom.mp4)');
    expect(p.links).toEqual([{ row: 2, label: 'Zoom animation', target: 'https://example.com/zoom.mp4' }]);
    expect(made({ markers: false }).markers).toEqual([]);
  });

  it('gives the preview each named section, running to the next one, only when rows are marked (#254)', () => {
    expect(made().sections).toEqual([{ start: 0, seconds: 14, title: 'Intro', row: 1 }, { start: 14, seconds: 2, title: 'Wrap-up', row: 3 }]);
    expect(made({ markers: false }).sections).toEqual([]);
  });

  it('gives two different files with the same name different names', () => {
    const s = parseScript(source.replace('- assets/push-in.mp4', '- other/leaf.jpg'));
    const p = plan(s, layout(s, (row: Row) => lengths[row.id]), EDIT);
    expect([...p.media.keys()].slice(0, 2)).toEqual(['leaf.jpg', 'leaf-2.jpg']);
  });
});

describe('toXml', () => {
  it('writes Final Cut Pro 7 XML with the frame size, the rate and frames for every clip', () => {
    const xml = toXml(made(), 'Leaves & light', EDIT, { 'leaf.jpg': { width: 3840, height: 2160 }, 'push-in.mp4': { width: 1920, height: 1080, seconds: 10 } });
    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<!DOCTYPE xmeml>\n<xmeml version="5">/);
    expect(xml).toContain('<name>Leaves &amp; light</name>');
    expect(xml).toContain('<duration>480</duration>'); // 16 s at 30 fps
    expect(xml).toContain('<width>1920</width><height>1080</height><pixelaspectratio>square</pixelaspectratio>');
    expect(xml).toContain('<rate><timebase>30</timebase><ntsc>FALSE</ntsc></rate>');
    expect(xml).toMatch(/<name>push-in\.mp4<\/name><enabled>TRUE<\/enabled><duration>300<\/duration>.*?<start>60<\/start><end>120<\/end><in>0<\/in><out>60<\/out>/);
    expect(xml).toContain('<pathurl>media/leaf.jpg</pathurl>');
    expect(xml).toContain('<value>50</value>'); // a 4K picture scaled to fit HD
    expect(xml.match(/<file id="file-1"/g)).toHaveLength(1); // a file is described once, then referred to
    expect(xml).toContain('<sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>');
    expect(xml).toContain('<marker><name>Row 2</name><comment>Sun, water and air.\nNot in the zip: Zoom animation (https://example.com/zoom.mp4)</comment><in>180</in><out>-1</out></marker>');
    expect(new DOMParserLike(xml).ok).toBe(true);
  });

  it('writes 29.97 as NTSC with frames counted at 30000/1001', () => {
    const xml = toXml(made(), 'x', { ...EDIT, fps: '29.97' });
    expect(xml).toContain('<rate><timebase>30</timebase><ntsc>TRUE</ntsc></rate>');
    expect(xml).toContain(`<duration>${Math.round(16 * 30000 / 1001)}</duration>`);
  });

  it('ends a take early when the WAV is shorter than its turn', () => {
    const xml = toXml(made(), 'x', { ...EDIT, fps: '25' }, { 'take-3.wav': { seconds: 1 } });
    expect(xml).toMatch(/<name>take-3\.wav<\/name>.*?<start>350<\/start><end>375<\/end>/);
  });

  it('escapes paths with spaces', () => {
    const s = parseScript(source.replace('assets/leaf.jpg', 'assets/Leaf%20shot.jpg'));
    expect(toXml(plan(s, layout(s, (row: Row) => lengths[row.id]), EDIT), 'x', EDIT)).toContain('<pathurl>media/Leaf%2520shot.jpg</pathurl>');
  });
});

describe('toSrt', () => {
  it('times each row\'s dialogue like the timeline', () => {
    expect(toSrt(made({ captions: true }).captions)).toBe(
      '1\n00:00:00,000 --> 00:00:04,000\nEvery leaf is a tiny factory.\n\n2\n00:00:06,000 --> 00:00:11,000\nSun, water and air.\n\n3\n00:00:14,000 --> 00:00:16,000\nAnd the leftover?\n');
    expect(made().captions).toEqual([]);
  });
});

// Checks the XML's tags open and close in order (no DOMParser in Node).
class DOMParserLike {
  ok = true;
  constructor(xml: string) {
    const stack: string[] = [];
    for (const m of xml.replace(/<\?[^>]*\?>|<!DOCTYPE[^>]*>/g, '').matchAll(/<(\/?)([a-z]+)[^>]*?(\/?)>/g)) {
      if (m[3]) continue;
      if (!m[1]) stack.push(m[2]);
      else if (stack.pop() !== m[2]) this.ok = false;
    }
    if (stack.length) this.ok = false;
  }
}
