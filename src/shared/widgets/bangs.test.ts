import { describe, expect, it } from 'vitest';
import { bangs } from './bangs';

describe('helium bangs', () => {
  it('copied from helium.computer (>20 entries)', () => {
    expect(bangs.length).toBeGreaterThan(20);
  });

  it('includes gh -> GitHub', () => {
    expect(bangs.find((b) => b.shortcut === 'gh')).toBeTruthy();
  });

  it('each bang has title, shortcut, url with {QUERY}', () => {
    for (const b of bangs) {
      expect(b.title.length).toBeGreaterThan(0);
      expect(b.shortcut.length).toBeGreaterThan(0);
      expect(b.url).toContain('{QUERY}');
    }
  });
});
