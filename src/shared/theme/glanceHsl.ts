import type { ThemeConfig, ThemePreset } from '../config';
import { hslToHex, invertLuminance, type Base16Colors } from './base16';
import type { Preset } from './presets';

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

/** Glance documented fallbacks (docs/configuration.md §Theme) for a block
 * that omits a color. */
const DEFAULT_BG = '240 8 9';
const DEFAULT_PRIMARY = '43 50 70';
const DEFAULT_NEGATIVE = '0 70 70';

function parseOr(input: string | undefined, fallback: string): { h: number; s: number; l: number } {
  return parseHsl(input ?? '') ?? parseHsl(fallback)!;
}

/**
 * Expand a glance HSL theme block (a `theme.presets` entry) into a full
 * base16 palette so config presets flow through the existing Preset
 * machinery. Mirrors the glance-classics ramp in presets.ts: surfaces step
 * off the background lightness, text derives from the light/dark polarity,
 * accents pass through with glance's documented defaults for missing colors.
 *
 * contrast-multiplier / text-saturation-multiplier are accepted for config
 * compat but intentionally ignored (user decision).
 */
export function hslBlockToColors(block: ThemePreset): Base16Colors {
  const isLight = block.light === true;
  const step = isLight ? -5 : 5;
  const bg = parseOr(block['background-color'], DEFAULT_BG);
  const lift = (offset: number) => Math.max(4, Math.min(96, bg.l + offset));
  const textL = isLight ? 12 : 88;
  const mutedL = isLight ? 35 : 65;
  const primary = parseOr(block['primary-color'], DEFAULT_PRIMARY);
  const positive = parseOr(block['positive-color'], `${primary.h} ${primary.s} ${primary.l}`);
  const negative = parseOr(block['negative-color'], DEFAULT_NEGATIVE);
  const at = (c: { h: number; s: number; l: number }, l: number) => hslToHex(c.h, c.s, l);
  return {
    base00: at(bg, bg.l),
    base01: at(bg, lift(step)),
    base02: at(bg, lift(step * 2)),
    base03: at(bg, lift(step * 3)),
    base04: at(bg, mutedL),
    base05: at(bg, textL),
    base06: at(bg, isLight ? 75 : 80),
    base07: isLight ? '#ffffff' : '#000000',
    base08: at(negative, 60),
    base09: '#d98b3d',
    base0A: '#d9b23d',
    base0B: at(positive, 55),
    base0C: '#4f9e9e',
    base0D: at(primary, 55),
    base0E: '#8a6fc0',
    base0F: '#9e7b5a',
  };
}

/**
 * Config-declared presets (`theme.presets`) as selectable Presets keyed by
 * their config key. A light block provides the light side with the dark
 * side derived via luminance inversion; a dark block the reverse.
 */
export function buildConfigPresets(theme?: ThemeConfig): Preset[] {
  if (!theme?.presets) return [];
  return Object.entries(theme.presets).map(([id, block]) => {
    const colors = hslBlockToColors(block);
    const isLight = block.light === true;
    return {
      id,
      name: id,
      variant: isLight ? 'light' : 'dark',
      dark: isLight ? invertLuminance(colors) : colors,
      light: isLight ? colors : undefined,
    };
  });
}
