// Numbered files folded together (EX-25, issue #255, board 86): in a sorted list, files whose names differ only by
// their last number (card-row-1.png … card-row-4.png) are one run; a run of three or more is shown folded.

/** The name with its last number taken out, so card-row-1.png and card-row-12.png give the same key; null if none. */
const key = (name: string) => {
  const m = /^(.*?)(\d+)(\D*)$/.exec(name);
  return m ? `${m[1]}\u0000${m[3]}` : null;
};

/** Splits an already sorted list into runs of neighbours that differ only by a number (and agree on `same`). */
export function numberRuns<T>(items: T[], name: (t: T) => string, same: (a: T, b: T) => boolean = () => true): T[][] {
  const runs: T[][] = [];
  for (const item of items) {
    const last = runs.at(-1)?.at(-1);
    const k = key(name(item));
    if (last !== undefined && k !== null && k === key(name(last)) && same(last, item)) runs.at(-1)!.push(item);
    else runs.push([item]);
  }
  return runs;
}

/** A run this long or longer folds to first ↓ last. */
export const FOLD_FROM = 3;
