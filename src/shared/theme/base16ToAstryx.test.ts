import { describe, expect, it } from 'vitest';
import { buildTheme } from './base16ToAstryx';
import type { Base16Colors } from './base16';

const light: Base16Colors = {
  base00: '#fafafa', base01: '#f0f0f0', base02: '#e0e0e0', base03: '#b8b8b8',
  base04: '#888888', base05: '#333333', base06: '#222222', base07: '#111111',
  base08: '#cc0000', base09: '#d9822b', base0A: '#d9c52b', base0B: '#2bcc2b',
  base0C: '#2bc9c9', base0D: '#2b6fcc', base0E: '#8a2bcc', base0F: '#7a4a2b',
};
const dark: Base16Colors = {
  base00: '#111111', base01: '#222222', base02: '#333333', base03: '#555555',
  base04: '#888888', base05: '#e0e0e0', base06: '#f0f0f0', base07: '#fafafa',
  base08: '#ff5555', base09: '#ffaa55', base0A: '#ffff55', base0B: '#55ff55',
  base0C: '#55ffff', base0D: '#5599ff', base0E: '#cc55ff', base0F: '#bb8855',
};

// defineTheme compiles [light, dark] tuples to light-dark() at creation.
const ld = (l: string, d: string) => `light-dark(${l}, ${d})`;

describe('buildTheme', () => {
  it('maps the ramp and accent roles as light-dark tuples', () => {
    const tokens = buildTheme('test', light, dark).tokens as Record<string, string>;
    expect(tokens['--color-background-body']).toBe(ld(light.base00, dark.base00));
    expect(tokens['--color-background-card']).toBe(ld(light.base02, dark.base02));
    expect(tokens['--color-border']).toBe(ld(light.base03, dark.base03));
    expect(tokens['--color-text-secondary']).toBe(ld(light.base04, dark.base04));
    expect(tokens['--color-text-primary']).toBe(ld(light.base05, dark.base05));
  });

  it('maps the accent and status roles', () => {
    const tokens = buildTheme('test', light, dark).tokens as Record<string, string>;
    expect(tokens['--color-accent']).toBe(ld(light.base0D, dark.base0D));
    expect(tokens['--color-success']).toBe(ld(light.base0B, dark.base0B));
    expect(tokens['--color-error']).toBe(ld(light.base08, dark.base08));
    expect(tokens['--color-warning']).toBe(ld(light.base0A, dark.base0A));
  });

  it('maps every accent to its hue token families', () => {
    const tokens = buildTheme('test', light, dark).tokens as Record<string, string>;
    expect(tokens['--color-text-red']).toBe(ld(light.base08, dark.base08));
    expect(tokens['--color-icon-cyan']).toBe(ld(light.base0C, dark.base0C));
    expect(tokens['--color-border-blue']).toBe(ld(light.base0D, dark.base0D));
    expect(tokens['--color-text-purple']).toBe(ld(light.base0E, dark.base0E));
    // background hues get an alpha suffix
    expect(tokens['--color-background-red']).toContain('#cc000033');
    expect(tokens['--color-background-red']).toContain('#ff555533');
  });

  it('produces a valid DefinedTheme with a name', () => {
    const t = buildTheme('catppuccin-mocha', light, dark);
    expect(t.name).toBe('catppuccin-mocha');
  });
});
