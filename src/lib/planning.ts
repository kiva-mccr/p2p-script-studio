// The planning panel's notes (AP-24): plan.md, a plain Markdown file beside script.md (docs/script-format.md).

import { announce } from './news';

const PLAN = 'plan.md';

// The plan's text, '' if the script has none yet.
export async function readPlan(dir: FileSystemDirectoryHandle): Promise<string> {
  try {
    return await (await (await dir.getFileHandle(PLAN)).getFile()).text();
  } catch (e) {
    if ((e as DOMException).name === 'NotFoundError') return '';
    throw e;
  }
}

export async function writePlan(dir: FileSystemDirectoryHandle, text: string): Promise<void> {
  const writable = await (await dir.getFileHandle(PLAN, { create: true })).createWritable();
  await writable.write(text);
  await writable.close();
  await announce(dir, 'plan');
}

// Two people changed the plan at once: yours, then the lines they added that you don't have, so nothing they
// typed is lost. (What they deleted stays; a plan is notes, so that is the safe side.)
export function combinePlans(base: string, mine: string, theirs: string): string {
  if (theirs === base || theirs === mine) return mine;
  if (mine === base) return theirs;
  const known = new Set([...base.split('\n'), ...mine.split('\n')]);
  const added = theirs.split('\n').filter((line) => line.trim() && !known.has(line));
  return added.length ? mine.replace(/\n*$/, '') + '\n\n' + added.join('\n') + '\n' : mine;
}

// The plan as Review shows it (#233, board 82): one entry per line, a tick box line with its tick and its words.
export type PlanLine = { text: string; tick?: boolean };
const TICK = /^- \[([ xX])\] /;

export function planLines(text: string): PlanLine[] {
  if (!text.trim()) return [];
  return text.replace(/\n+$/, '').split('\n').map((line) => {
    const m = TICK.exec(line);
    return m ? { text: line.slice(m[0].length), tick: m[1] !== ' ' } : { text: line };
  });
}

// The plan with the tick box on line `index` ticked or unticked; anything else on the line is kept.
export function flipTick(text: string, index: number): string {
  const lines = text.split('\n');
  const line = lines[index];
  if (line === undefined || !TICK.test(line)) return text;
  lines[index] = line.replace(TICK, (_, mark) => (mark === ' ' ? '- [x] ' : '- [ ] '));
  return lines.join('\n');
}
