import { describe, expect, it } from 'vitest';
import { pastedName } from '../../src/lib/pasted';

describe('pastedName (#304)', () => {
  const at = new Date(2026, 10, 8, 9, 4);
  it('names a screen grab by when it was pasted, in local time', () => {
    expect(pastedName({ name: 'image.png', type: 'image/png' }, at)).toBe('pasted 2026-11-08 09-04.png');
  });
  it('takes the extension from the type, else from the name', () => {
    expect(pastedName({ name: 'image.png', type: 'image/jpeg' }, at)).toBe('pasted 2026-11-08 09-04.jpg');
    expect(pastedName({ name: 'Scan.HEIC', type: 'image/heic' }, at)).toBe('pasted 2026-11-08 09-04.heic');
    expect(pastedName({ name: 'image', type: 'image/x-odd' }, at)).toBe('pasted 2026-11-08 09-04.png');
  });
});
