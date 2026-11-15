// What in a script waits for you (RV-14), for the "For me" filter on the script list: your review, answered
// comments, and a script of yours sent back. Worked out from the script's History and comment files, so it is the
// same on every computer; nothing is stored per person.

import { threads, type Note } from './comments';
import { holdEnds, isSend, type Version } from './history';

export type ForMe = { review: boolean; replies: number; back: boolean };

const same = (a: string, b: string) => nameKey(a) === nameKey(b);

// `versions` oldest first, `notes` as listScripts and listNotes give them.
export function forMe(me: string, status: string, versions: Version[], notes: Note[]): ForMe {
  if (!me.trim()) return { review: false, replies: 0, back: false };
  return forWho((who) => same(who, me), status, versions, notes);
}

// For me for everyone at once (PF-12, the shared summary): `by` holds each name it differs for (trimmed, lower
// case), `anyone` holds the rest. Same answers as forMe.
export type ForAll = { by: Record<string, ForMe>; anyone: ForMe };
export const nameKey = (name: string) => name.trim().toLowerCase();

export function forAll(status: string, versions: Version[], notes: Note[]): ForAll {
  const anyone = forWho(() => false, status, versions, notes);
  const by: Record<string, ForMe> = {};
  for (const name of new Set([...versions, ...notes].map((x) => nameKey(x.who)))) {
    if (!name) continue;
    const f = forWho((who) => nameKey(who) === name, status, versions, notes);
    if (f.review !== anyone.review || f.replies !== anyone.replies || f.back !== anyone.back) by[name] = f;
  }
  return { by, anyone };
}

export function pick(all: ForAll, me: string): ForMe {
  return me.trim() ? (all.by[nameKey(me)] ?? all.anyone) : { review: false, replies: 0, back: false };
}

function forWho(isMe: (who: string) => boolean, status: string, versions: Version[], notes: Note[]): ForMe {
  const reviews = versions.filter((v) => v.kind === 'review');
  const newest = reviews.at(-1);
  const send = reviews.findLast(isSend);
  // In review and someone else sent it (no reviewers are assigned). With no send in History, nobody is known to
  // have sent it, so it waits for everyone.
  const review = status === 'in review' && !(send && isMe(send.who));
  // A draft whose newest review change is a send back, of a send that was yours.
  const back = status === 'draft' && !!newest?.note.startsWith('Sent back') && !!send && isMe(send.who);
  // Open comments you wrote in where the newest word is someone else's (not those on hold, RV-19).
  const replies = threads(notes, false, holdEnds(versions)).filter((t) => {
    if (t.resolved || t.held) return false;
    const said = [t.comment, ...t.replies];
    return said.some((n) => isMe(n.who)) && !isMe(said.at(-1)!.who);
  }).length;
  return { review, replies, back };
}

export const waiting = (f: ForMe | undefined) => !!f && (f.review || f.back || f.replies > 0);
