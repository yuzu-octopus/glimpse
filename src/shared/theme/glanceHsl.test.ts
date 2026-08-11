import { describe, expect, it } from 'vitest';
import { parseHsl } from './glanceHsl';

describe('parseHsl', () => {
  it('parses glance space-separated HSL', () => {
    expect(parseHsl('157 47 65')).toEqual({ h: 157, s: 47, l: 65 });
  });

  it('accepts optional percent signs', () => {
    expect(parseHsl('157 47% 65%')).toEqual({ h: 157, s: 47, l: 65 });
  });

  it('rejects malformed or out-of-range values', () => {
    expect(parseHsl('red')).toBeNull();
    expect(parseHsl('400 50 50')).toBeNull();
    expect(parseHsl('200 50')).toBeNull();
    expect(parseHsl('200 150 50')).toBeNull();
  });
});
