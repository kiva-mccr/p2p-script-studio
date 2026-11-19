import { describe, expect, it } from 'vitest';
import { howLong, statusAge } from '../../src/lib/statusage';
import type { Version } from '../../src/lib/history';

const min = 60000;
const day = 24 * 60 * min;
const entry = (kind: string, note: string, when: string, who = 'Sam') =>
  ({ v: 1, id: when, parents: [], who, when, kind, note, sha256: '', text: '' }) as Version;

describe('howLong', () => {
  it('says the time the way a person would', () => {
    expect(howLong(10000)).toBe('just now');
    expect(howLong(12 * min)).toBe('12 min');
    expect(howLong(3 * 60 * min)).toBe('3 h');
    expect(howLong(day)).toBe('1 day');
    expect(howLong(5 * day)).toBe('5 days');
    expect(howLong(21 * day)).toBe('3 weeks');
    expect(howLong(130 * day)).toBe('4 months');
    expect(howLong(800 * day)).toBe('2 years');
    expect(howLong(-5000)).toBe('just now'); // a clock a little ahead
  });
});

describe('statusAge', () => {
  const now = new Date(2026, 10, 18, 15, 12).getTime();
  const sent = new Date(2026, 10, 16, 15, 12).toISOString();
  it('says how long since it was sent for review, and who sent it when', () => {
    const versions = [entry('edit', 'Saved', '2026-11-10T10:00:00Z'), entry('review', 'Sent for review', sent), entry('edit', 'Saved', '2026-11-17T10:00:00Z', 'Ana')];
    expect(statusAge(versions, 'in review', now)).toEqual({ age: '2 days', title: 'Sent for review by Sam, Monday, Nov 16, 3:12 pm' });
  });
  it('counts an approval, with or without things still open', () => {
    const versions = [entry('review', 'Sent for review', sent), entry('review', 'Approved, 2 still open', new Date(now - 3 * 60 * min).toISOString(), 'Ana')];
    expect(statusAge(versions, 'approved', now)?.age).toBe('3 h');
    expect(statusAge(versions, 'approved', now)?.title).toMatch(/^Approved, 2 still open by Ana, Wednesday, Nov 18, /);
  });
  it('shows nothing when the newest review entry did not set this status (changed by hand)', () => {
    expect(statusAge([entry('review', 'Sent back to writer', sent)], 'in review', now)).toBeNull();
    expect(statusAge([entry('review', 'Sent for review', sent)], 'approved', now)).toBeNull();
    expect(statusAge([], 'in review', now)).toBeNull();
    expect(statusAge([entry('review', 'Sent for review', sent)], 'draft', now)).toBeNull();
  });
});
