import { describe, expect, it } from 'vitest';
import { addMarks } from '../../src/lib/marks';

describe('marks (AP-48)', () => {
  it('marks each element with its file, but not the insides of an svg or components', () => {
    const src = `<script lang="ts">\n  let a: number = 1;\n  const b = a < 2;\n</script>\n\n{#if b}<div class="x"><button onclick={() => a++}>Go {a > 0}</button><svg><path d="M0 0" /></svg><Child /></div>{/if}\n<style>div { color: red; }</style>`;
    const out = addMarks(src, 'Row')!.code;
    expect(out).toContain('<div data-c="Row" class="x">');
    expect(out).toContain('<button data-c="Row" onclick=');
    expect(out).toContain('<svg data-c="Row">');
    expect(out).toContain('<path d="M0 0" />');
    expect(out).toContain('<Child />');
    expect(out).toContain('const b = a < 2;');
  });

  it('leaves a file it cannot read as it is', () => {
    expect(addMarks('<div', 'Bad')).toBeNull();
  });
});
