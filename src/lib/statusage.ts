// How long a script has been in its status (#230, board 87): "2 days" on the top bar's pill, and on hover who put it
// there and when ("Sent for review by Sam, Monday, Nov 16, 3:12 pm"). Read from History's newest review entry.

import type { Version } from './history';

export type StatusAge = { age: string; title: string };

// The newest review entry, if it is the one that set `status` (not one the front matter was changed past by hand).
export function statusAge(versions: Version[], status: string, now = Date.now()): StatusAge | null {
  const entry = versions.findLast((v) => v.kind === 'review');
  if (!entry) return null;
  const fits = status === 'in review' ? entry.note === 'Sent for review' : status === 'approved' ? entry.note.startsWith('Approved') : false;
  const time = Date.parse(entry.when);
  if (!fits || !Number.isFinite(time)) return null;
  const date = new Date(time);
  const day = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: date.getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
  const clock = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).replace(' AM', ' am').replace(' PM', ' pm');
  return { age: howLong(now - time), title: `${entry.note} by ${entry.who}, ${day}, ${clock}` };
}

// "just now", "12 min", "3 h", "1 day", "5 days", "3 weeks", "4 months", "2 years".
export function howLong(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h`;
  const days = Math.floor(min / (24 * 60));
  const n = (count: number, unit: string) => `${count} ${unit}${count === 1 ? '' : 's'}`;
  if (days < 14) return n(days, 'day');
  if (days < 61) return n(Math.floor(days / 7), 'week');
  if (days < 365) return n(Math.floor(days / 30), 'month');
  return n(Math.floor(days / 365), 'year');
}
