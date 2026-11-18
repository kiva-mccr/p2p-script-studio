import { describe, expect, it } from 'vitest';
import { plan, Player } from '../../src/lib/play.svelte';
import type { Script } from '../../src/lib/script';

const row = (id: string, dialogue: string) => ({ type: 'row' as const, id, dialogue, onScreen: '', files: [], timeline: '', note: '' });
const take = (seconds: number) => ({ by: 'Sam', at: 0, seconds, text: '' });
const script: Script = {
  front: null, intro: '',
  blocks: [row('a', 'one two three'), { type: 'section', title: 'Next', note: '' }, row('b', 'one two three four five'), row('c', ''), row('d', '')],
};

describe('plan', () => {
  it('plays the rows in order, each starting where the last one ends', () => {
    expect(plan(script, { a: take(4), d: take(1.5) }, 150)).toEqual([
      { id: 'a', seconds: 4, take: true, start: 0 },
      { id: 'b', seconds: 2, take: false, start: 4 }, // no take: five words at 150 a minute
      { id: 'd', seconds: 1.5, take: true, start: 6 }, // a take with no dialogue still plays
    ]);
  });
  it('skips a row with no take and no dialogue', () => {
    expect(plan(script, {}, 150).map((s) => s.id)).toEqual(['a', 'b']);
  });
});

describe('plan with the storyboard timeline (SB-1)', () => {
  it('plays a hold or placeholder after its row, in silence', () => {
    const s: Script = { front: null, intro: '', blocks: [{ ...row('a', 'one two three'), timeline: 'then hold 2 s' }, { ...row('b', ''), timeline: 'then placeholder 3 s "Drone"' }] };
    expect(plan(s, { a: take(4) }, 150)).toEqual([
      { id: 'a', seconds: 4, take: true, start: 0 },
      { id: 'hold:a', seconds: 2, take: false, start: 4 },
      { id: 'placeholder:b', seconds: 3, take: false, start: 6 }, // row b has no time, its placeholder still plays
    ]);
  });
});

describe('Player.seek (#207: the timeline\'s playhead dropped somewhere)', () => {
  const steps = [{ id: 'a', seconds: 4, take: false, start: 0 }, { id: 'b', seconds: 2, take: false, start: 4 }, { id: 'c', seconds: 3, take: false, start: 6 }];
  it('jumps part way into the step at that time and plays, even if it was paused', async () => {
    const player = new Player();
    await player.start({} as FileSystemDirectoryHandle, steps);
    player.toggle();
    player.following = false;
    await player.seek(5.5);
    expect([player.row, player.elapsed, player.time, player.on, player.following]).toEqual(['b', 1.5, 5.5, true, true]);
    await player.seek(0);
    expect([player.row, player.time]).toEqual(['a', 0]);
    await player.seek(8.9);
    expect([player.row, player.time]).toEqual(['c', 8.9]);
    player.stop();
  });
  it('does nothing when stopped', async () => {
    const player = new Player();
    await player.seek(3);
    expect(player.started).toBe(false);
  });
});
