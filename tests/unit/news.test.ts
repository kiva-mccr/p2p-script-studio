import { describe, expect, it } from 'vitest';
import { scriptOf } from '../../src/lib/news';

describe('scriptOf', () => {
  it('reads the script folder from a note’s name, underscores and all', () => {
    expect(scriptOf('20261115T021500123Z_ab12cd_Episode 03.json')).toBe('Episode 03');
    expect(scriptOf('20261115T021500123Z_ab12cd_Intro_v2 (draft).json')).toBe('Intro_v2 (draft)');
  });
});
