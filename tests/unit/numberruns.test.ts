import { describe, expect, it } from 'vitest';
import { numberRuns } from '../../src/lib/numberruns';

const runs = (names: string[], same?: (a: string, b: string) => boolean) => numberRuns(names, (n) => n, same);

describe('numberRuns', () => {
  it('joins neighbours that differ only by their last number', () => {
    expect(runs(['card-row-1.png', 'card-row-2.png', 'card-row-4.png', 'glucose-model.png', 'take-1.wav', 'take-12.wav'])).toEqual([
      ['card-row-1.png', 'card-row-2.png', 'card-row-4.png'],
      ['glucose-model.png'],
      ['take-1.wav', 'take-12.wav'],
    ]);
  });

  it('keeps apart other extensions, other words around the number, and names with no number', () => {
    expect(runs(['a.png', 'b.png', 'take-1.mp3', 'take-2.wav', 'take-1-a.wav', 'take-2-b.wav', 'row-2-collage.png', 'row-3-collage.png'])).toEqual([
      ['a.png'], ['b.png'], ['take-1.mp3'], ['take-2.wav'], ['take-1-a.wav'], ['take-2-b.wav'], ['row-2-collage.png', 'row-3-collage.png'],
    ]);
  });

  it('only joins what `same` allows', () => {
    expect(runs(['x-1', 'x-2', 'x-3', 'x-4'], (_, b) => b !== 'x-3')).toEqual([['x-1', 'x-2'], ['x-3', 'x-4']]);
    expect(runs([])).toEqual([]);
  });
});
