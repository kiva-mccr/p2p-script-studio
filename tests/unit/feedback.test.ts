import { describe, expect, it } from 'vitest';
import { issueBody, issueTitle, issueUrl, placePanel, plainText, ringBox, type Part } from '../../src/lib/feedback';

const part: Part = { label: 'button "Record row 3"', file: 'WriteRow.svelte', tour: 'take', selector: '[data-row="r1"] > div.mic-cell > button.mic',
  row: 3, column: 'the mic', screen: 'Write' };
const env = { version: { pr: 164, title: 'Feedback mode', at: '2026-11-15T16:00:00Z' }, ua: 'Mozilla/5.0 (Windows NT 10.0) Chrome/131.0 Safari/537.36', width: 1366, height: 768 };

describe('feedback issues (AP-48)', () => {
  it('always has the same shape, with what is needed to find the part', () => {
    const body = issueBody('Hard | to tell', part, env, true);
    expect(body.split('\n')).toEqual([
      '**Note**', '', 'Hard | to tell', '',
      '| | |', '|---|---|',
      '| Screen | Write |',
      '| Part | button "Record row 3" |',
      '| Code | WriteRow.svelte, data-tour="take" |',
      '| Selector | `[data-row="r1"] > div.mic-cell > button.mic` |',
      '| Row, column | row 3, the mic |',
      '| Version | PR #164 (Feedback mode) |',
      '| Browser | Chrome 131 on Windows, window 1366 × 768 |',
      '', '**Picture**', '', '<!-- Paste the picture here: Ctrl+V -->', '',
      '_Sent with Feedback in P2P Script Studio (AP-48)._',
    ]);
  });

  it('names the script only when given, and escapes table bars', () => {
    const body = issueBody('', { ...part, row: null, column: '' }, { ...env, script: 'Ep | 3', page: '#/Ep' }, false);
    expect(body).toContain('(no note)');
    expect(body).toContain('| Screen | Write (#/Ep) |');
    expect(body).toContain('| Script | Ep \\| 3 |');
    expect(body).not.toContain('Row, column');
    expect(body).not.toContain('Picture');
  });

  it('fills in GitHub\'s new issue page with the feedback label', () => {
    const url = new URL(issueUrl(issueTitle(part), 'Body & more'));
    expect(url.href.startsWith('https://github.com/kiva-mccr/p2p-script-studio/issues/new?')).toBe(true);
    expect(url.searchParams.get('title')).toBe('Feedback: button "Record row 3" (Write)');
    expect(url.searchParams.get('body')).toBe('Body & more');
    expect(url.searchParams.get('labels')).toBe('feedback');
  });

  it('copies as plain text without the paste hint', () => {
    const text = plainText('T', issueBody('n', part, env, true));
    expect(text.startsWith('T\n\n**Note**')).toBe(true);
    expect(text).toContain('(no picture)');
  });
});

describe('the feedback panel stays on screen (AP-48 fix)', () => {
  const view = { width: 1280, height: 800 };
  const panel = { width: 440, height: 400 };
  it('goes below a part near the top, above one near the bottom', () => {
    expect(placePanel({ left: 100, top: 50, bottom: 80 }, panel, view)).toEqual({ left: 100, top: 90 });
    expect(placePanel({ left: 100, top: 700, bottom: 730 }, panel, view)).toEqual({ left: 100, top: 290 });
  });
  it('is shifted inside the window when neither fits, never past an edge', () => {
    // The bug: a part in the middle of a short window put the panel above it, cut off at the top.
    const at = placePanel({ left: 1200, top: 300, bottom: 340 }, panel, { width: 1280, height: 600 });
    expect(at).toEqual({ left: 832, top: 192 });
    expect(at.top).toBeGreaterThanOrEqual(8);
    expect(at.top + panel.height).toBeLessThanOrEqual(592);
    // A panel taller than the window starts at the top edge (it scrolls inside).
    expect(placePanel({ left: 0, top: 10, bottom: 20 }, { width: 440, height: 900 }, view).top).toBe(8);
  });
});

describe('the ring round a part (issue #216)', () => {
  const view = { width: 1280, height: 800 };
  it('sits 3 px outside a part', () => {
    expect(ringBox({ left: 100, top: 50, right: 300, bottom: 80 }, view)).toEqual({ left: 97, top: 47, width: 206, height: 36 });
  });
  it('stays inside the window for a part as big as the window, or it was all off screen', () => {
    expect(ringBox({ left: 0, top: 0, right: 1280, bottom: 800 }, view)).toEqual({ left: 0, top: 0, width: 1280, height: 800 });
    expect(ringBox({ left: -40, top: 700, right: 200, bottom: 900 }, view)).toEqual({ left: 0, top: 697, width: 203, height: 103 });
  });
});
