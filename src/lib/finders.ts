// Who finds or films each missing shot (#211, board 88). A "to find" note in the Files column can name the people on
// it: `Drone shot of a river (to find: Ana, Sam)`, or `(to film: Ana)` on a note marked "(to film)". Older copies of
// the app read it as a note, as before, so the script format gains no new field. See docs/script-format.md.

import { markTimelineOnly, timelineOnly } from './script';

const MARK = /\s*\(to (find|film)(?::([^)]*))?\)$/i;
const TIMELINE = /\s+\(timeline\)$/;

// The people named on a note, as written (trimmed, no blanks, each once ignoring case).
export function finders(line: string): string[] {
  const names = line.replace(TIMELINE, '').match(MARK)?.[2]?.split(',') ?? [];
  const seen = new Set<string>();
  return names.map((n) => n.trim()).filter((n) => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()));
}

// The note without its people: "Drone shot (to find: Ana)" reads "Drone shot (to find)", so the same shot given to
// different people in two rows is still one item in Assets.
export function bare(line: string): string {
  return line.replace(TIMELINE, '').replace(MARK, (_, verb: string) => ` (to ${verb})`).trim();
}

// The note with these people on it (none: plain "(to find)"). A note written without "(to find)" gains it; one
// marked "(to film)" stays so.
export function withFinders(line: string, names: string[]): string {
  const marked = timelineOnly(line);
  const plain = line.replace(TIMELINE, '');
  const verb = plain.match(MARK)?.[1] ?? 'find';
  const next = `${plain.replace(MARK, '').trim()} (to ${verb}${names.length ? `: ${names.join(', ')}` : ''})`;
  return marked ? markTimelineOnly(next) : next;
}
