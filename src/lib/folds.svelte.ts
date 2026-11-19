// Columns folded away to a thin strip (AP-17 in Write, RV-23 in Review): which are folded, remembered in this browser
// for every script under the screen's own key, never in the script.
import { keep, recall } from './remember';

export type Column = 'dialogue' | 'screen' | 'files';
// Write's Speaker column (#221) folds too, but isn't one of the three: it may be folded with all of them open or not.
type Key = Column | 'speaker';
export const COLUMNS: { key: Column; name: string }[] = [
  { key: 'dialogue', name: 'Dialogue' },
  { key: 'screen', name: 'On screen' },
  { key: 'files', name: 'Images & files' },
];

export class Folds {
  folded = $state(new Set<Key>());

  constructor(private key: string) {
    const stored = new Set(recall(key).split(',').filter((c): c is Key => c === 'speaker' || COLUMNS.some((col) => col.key === c)));
    // Never all three: the last one open has no fold button, and a stored "all folded" opens Dialogue again.
    if (COLUMNS.every((c) => stored.has(c.key))) stored.delete('dialogue');
    this.folded = stored;
  }

  has = (key: Key) => this.folded.has(key);

  // How many of the three are folded (the last one open has no fold button).
  get shut(): number {
    return COLUMNS.filter((c) => this.folded.has(c.key)).length;
  }

  toggle = (key: Key) => {
    const next = new Set(this.folded);
    if (!next.delete(key)) next.add(key);
    this.folded = next;
    keep(this.key, [...next].join(','));
  };

  open = (key: Key) => {
    if (this.folded.has(key)) this.toggle(key);
  };

  // The grid's columns: `lead` (the number and so on), Write's Speaker column when shown (#221), then each column at its
  // share, or a 28px strip when folded.
  grid(lead: string, fr: [number, number, number], speaker = false): string {
    const who = speaker ? (this.folded.has('speaker') ? ' 28px' : ' 120px') : '';
    return `${lead}${who} ${COLUMNS.map((c, i) => (this.folded.has(c.key) ? '28px' : `minmax(0, ${fr[i]}fr)`)).join(' ')}`;
  }
}
