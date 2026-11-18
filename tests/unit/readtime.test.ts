import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { clock, countWords, dialogueWords, writtenWords, scriptWords, sectionWords, setSpeed, speaking, SPEED, speedFrom } from '../../src/lib/readtime.svelte';
import { parseScript } from '../../src/lib/script';

const example = parseScript(readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8'));

describe('countWords', () => {
  it('counts the words as they read, without marks', () => {
    expect(countWords('Every **leaf** you have *ever* seen.')).toBe(6);
    expect(countWords('Read [the guide](https://example.com) now')).toBe(4);
    expect(countWords('  ')).toBe(0);
    expect(countWords('one\ntwo  three')).toBe(3);
  });
});

describe('the word count (#253)', () => {
  it('leaves equations out, and counts the dialogue only', () => {
    expect(writtenWords('Light is $E = mc^2$ here')).toBe(3);
    expect(writtenWords('$x$ and $y$')).toBe(1);
    expect(writtenWords('It costs $5 **now**')).toBe(4); // a lone $ isn't an equation
    expect(dialogueWords(example)).toBe(63);
    const script = parseScript('# One\n\n## 1 <!-- id: a1b2c -->\nDialogue:\nTwo $a+b$ words\n\nOn screen:\nNot counted here\n');
    expect(dialogueWords(script)).toBe(2);
  });
});

describe('clock', () => {
  it('shows minutes and seconds', () => {
    expect(clock(102)).toBe('1:42');
    expect(clock(5.4)).toBe('0:05');
    expect(clock(725)).toBe('12:05');
    expect(clock(-3)).toBe('0:00');
  });
});

describe('read time', () => {
  it('counts each section\'s dialogue, and the whole script\'s', () => {
    const words = [...sectionWords(example)].map(([b, n]) => [b.type === 'section' && b.title, n]);
    expect(words).toEqual([['Intro', 21], ['Inside the leaf', 32], ['Wrap-up', 10]]);
    expect(scriptWords(example)).toBe(63);
    expect(clock((scriptWords(example) / SPEED) * 60)).toBe('0:25');
  });
  it('leaves rows before the first section out of the sections', () => {
    const script = parseScript('## 1\nDialogue: one two\n\n# Part\n\n## 2\nDialogue: three\n');
    expect([...sectionWords(script).values()]).toEqual([1]);
    expect(scriptWords(script)).toBe(3);
  });
});

describe('speaking speed', () => {
  it('starts at 150 and keeps between 60 and 400', () => {
    expect(speedFrom('')).toBe(150);
    expect(speedFrom('abc')).toBe(150);
    expect(speedFrom('172.4')).toBe(172);
    expect(speedFrom('20')).toBe(60);
    expect(speedFrom('900')).toBe(400);
  });
  it('ignores something that is not a number', () => {
    setSpeed(180);
    expect(speaking.wpm).toBe(180);
    setSpeed(Number(''));
    setSpeed(NaN);
    expect(speaking.wpm).toBe(180);
    setSpeed(1000);
    expect(speaking.wpm).toBe(400);
  });
});
