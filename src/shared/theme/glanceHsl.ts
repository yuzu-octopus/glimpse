import type { ThemeConfig } from '../config';
import { hslToHex } from './base16';

/** Glance HSL color format: "h s l", space-separated, % optional. */
export function parseHsl(input: string): { h: number; s: number; l: number } | null {
  const m = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%?\s+(\d+(?:\.\d+)?)%?$/.exec(input.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const s = Number(m[2]);
  const l = Number(m[3]);
  if (h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100) return null;
  return { h, s, l };
}

/**
 * Map a glance YAML theme block (docs/configuration.md §Theme) to Astryx
 * token overrides. background drives the surface ramp, primary the accent,
 * positive/negative the status colors. Values are single strings (same in
 * both modes) — the mode is decided by the YAML `light` flag.
 */
export function customThemeTokens(theme: ThemeConfig): Record<string, string> {
  const tokens: Record<string, string> = {};
  const toHex = (key: keyof ThemeConfig, target: string) => {
    const v = theme[key];
    if (typeof v !== 'string') return;
    const c = parseHsl(v);
    if (c) tokens[target] = hslToHex(c.h, c.s, c.l);
  };
  toHex('background-color', '--color-background-body');
  toHex('background-color', '--color-background-surface');
  toHex('background-color', '--color-background-card');
  toHex('background-color', '--color-background-popover');
  toHex('background-color', '--color-border');
  toHex('primary-color', '--color-accent');
  toHex('primary-color', '--color-text-accent');
  toHex('primary-color', '--color-icon-accent');
  toHex('positive-color', '--color-success');
  toHex('negative-color', '--color-error');
  return tokens;
}
