import { describe, expect, it } from 'vitest';
import { bare, finders, withFinders } from '../../src/lib/finders';
import { findsBy } from '../../src/lib/assets';
import { forAll, forMe, pick, waiting } from '../../src/lib/forme';
import { parseScript } from '../../src/lib/script';

describe('who finds each missing shot (#211)', () => {
  it('reads the people on a note, each once', () => {
    expect(finders('Drone shot (to find: Ana, Sam)')).toEqual(['Ana', 'Sam']);
    expect(finders('Drone shot (to find: Ana, , ana , Lee)')).toEqual(['Ana', 'Lee']);
    expect(finders('Park b-roll (to film: Sam) (timeline)')).toEqual(['Sam']);
    expect(finders('Drone shot (to find)')).toEqual([]);
    expect(finders('Drone shot')).toEqual([]);
  });

  it('writes them, keeping "to film" and the timeline mark', () => {
    expect(withFinders('Drone shot (to find)', ['Ana'])).toBe('Drone shot (to find: Ana)');
    expect(withFinders('Drone shot (to find: Ana)', ['Ana', 'Sam'])).toBe('Drone shot (to find: Ana, Sam)');
    expect(withFinders('Drone shot (to find: Ana)', [])).toBe('Drone shot (to find)');
    expect(withFinders('Drone shot', ['Ana'])).toBe('Drone shot (to find: Ana)');
    expect(withFinders('Park b-roll (to film)', ['Sam'])).toBe('Park b-roll (to film: Sam)');
    expect(withFinders('Icon (to find) (timeline)', ['Lee'])).toBe('Icon (to find: Lee) (timeline)');
  });

  it('the note without its people is the same item', () => {
    expect(bare('Drone shot (To find: Ana)')).toBe('Drone shot (to find)');
    expect(bare('Park b-roll (to film: Sam)')).toBe('Park b-roll (to film)');
    expect(bare('Drone shot')).toBe('Drone shot');
  });

  it('counts each person once per item, and For me waits for them', () => {
    const script = parseScript(['## 1 <!-- id: aaaaa -->', 'Dialogue: a', '', 'On screen:', '', 'Files:', '- Drone shot (to find: Ana)', '- Map (to find: ana, Sam)', '',
      '## 2 <!-- id: bbbbb -->', 'Dialogue: b', '', 'On screen:', '', 'Files:', '- drone shot (to find: Lee)', ''].join('\n'));
    const finds = findsBy(script);
    expect(finds).toEqual({ ana: 2, sam: 1, lee: 1 });
    expect(forMe('Ana ', 'draft', [], [], finds).finds).toBe(2);
    expect(waiting(forMe('Sam', 'draft', [], [], finds))).toBe(true);
    expect(waiting(forMe('Kiva', 'draft', [], [], finds))).toBe(false);
    const all = forAll('draft', [], [], finds);
    for (const me of ['Ana', 'Sam', 'Lee', 'Kiva', '']) expect(pick(all, me)).toEqual(forMe(me, 'draft', [], [], finds));
  });
});
