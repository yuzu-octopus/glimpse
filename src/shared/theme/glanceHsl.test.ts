import { describe, expect, it } from 'vitest';
import { customThemeTokens, parseHsl } from './glanceHsl';

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

describe('customThemeTokens', () => {
  it('maps glance theme fields to astryx tokens', () => {
    const tokens = customThemeTokens({
      'background-color': '0 0 10',
      'primary-color': '217 92 83',
      'positive-color': '120 60 50',
      'negative-color': '0 100 50',
    });
    expect(tokens['--color-background-body']).toBe('#1a1a1a');
    expect(tokens['--color-accent']).toBeDefined();
    expect(tokens['--color-accent']).toMatch(/^#[0-9a-f]{6}$/);
    expect(tokens['--color-success']).toBeDefined();
    expect(tokens['--color-error']).toBeDefined();
    expect(tokens['--color-error']).toBe('#ff0000');
  });

  it('returns an empty map for an empty theme block', () => {
    expect(customThemeTokens({})).toEqual({});
  });

  it('ignores malformed color strings', () => {
    const tokens = customThemeTokens({ 'background-color': 'nope' });
    expect(tokens).toEqual({});
  });
});
