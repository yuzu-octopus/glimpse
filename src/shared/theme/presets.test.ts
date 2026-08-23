import { describe, expect, it } from 'vitest';
import { BASE16_KEYS, presets } from './presets';

const HEX = /^#[0-9a-fA-F]{6}$/;

describe('presets', () => {
  it('curates 48 presets (10 pairs deduped, 6 glance classics)', () => {
    expect(presets.length).toBe(48);
  });

  it('has unique ids and names', () => {
    const ids = presets.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = presets.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('every preset has a full 16-color dark palette of valid hexes', () => {
    for (const p of presets) {
      for (const key of BASE16_KEYS) {
        expect(p.dark[key], `${p.id}.${key}`).toMatch(HEX);
      }
    }
  });

  it('explicit light variants are valid hex palettes too', () => {
    for (const p of presets) {
      if (!p.light) continue;
      for (const key of BASE16_KEYS) {
        expect(p.light[key], `${p.id}.${key}`).toMatch(HEX);
      }
    }
  });

  it('includes the glance classics', () => {
    for (const id of ['teal-city', 'camouflage', 'tucan', 'neon-pink', 'peachy', 'zebra']) {
      expect(presets.some((p) => p.id === id), id).toBe(true);
    }
  });

  it('pairs popular families with explicit light variants', () => {
    for (const id of [
      'catppuccin-mocha', 'gruvbox-dark-hard', 'onedark', 'tokyo-night-dark',
      'rose-pine', 'ayu-dark', 'solarized-dark', 'everforest-dark-medium',
    ]) {
      const p = presets.find((x) => x.id === id);
      expect(p?.light, `${id} should have a light side`).toBeDefined();
    }
  });

  it('preserves the base16 ramp order for dark palettes (base00 darkest)', () => {
    // spot-check the well-known catppuccin ramp
    const mocha = presets.find((p) => p.id === 'catppuccin-mocha')!.dark;
    expect(mocha.base00).toBe('#1e1e2e');
    expect(mocha.base05).toBe('#cdd6f4');
  });
});
