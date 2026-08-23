import type { Base16Colors, Base16Key } from './base16';
import { hslToHex, invertLuminance } from './base16';
import { generatedSchemes } from './schemes.generated';

export interface Preset {
  id: string;
  name: string;
  /** Which mode the scheme itself is authored for. */
  variant: 'dark' | 'light';
  dark: Base16Colors;
  /** Explicit light variant when the family ships one, else derived. */
  light?: Base16Colors;
}

const byId = new Map(generatedSchemes.map((s) => [s.id, s]));

function scheme(id: string) {
  const s = byId.get(id);
  if (!s) throw new Error(`missing curated scheme: ${id}`);
  return s;
}

/** Families that ship both a dark and a light variant (light side explicit). */
const PAIRS: [string, string][] = [
  ['catppuccin-mocha', 'catppuccin-latte'],
  ['gruvbox-dark-hard', 'gruvbox-light-soft'],
  ['onedark', 'one-light'],
  ['tokyo-night-dark', 'tokyo-night-light'],
  ['rose-pine', 'rose-pine-dawn'],
  ['ayu-dark', 'ayu-light'],
  ['solarized-dark', 'solarized-light'],
  ['everforest-dark-medium', 'everforest-light-soft'],
  ['material-darker', 'material-lighter'],
  ['tomorrow-night', 'tomorrow'],
];

const pairIds = new Set(PAIRS.flat());

const presetsFromSchemes: Preset[] = [];
for (const [darkId, lightId] of PAIRS) {
  presetsFromSchemes.push(fromScheme(darkId, scheme(lightId).colors));
}
for (const s of generatedSchemes) {
  if (pairIds.has(s.id)) continue; // already added as a pair (both sides)
  // Light-only scheme: the authored palette IS the light side; derive the
  // dark side. Dark-only: authored palette is the dark side; light side is
  // derived in sourcePairFromPreset.
  const dark = s.variant === 'light' ? invertLuminance(s.colors) : s.colors;
  const light = s.variant === 'light' ? s.colors : undefined;
  presetsFromSchemes.push({ id: s.id, name: s.name, variant: s.variant, dark, light });
}

function fromScheme(id: string, light?: Base16Colors): Preset {
  const s = scheme(id);
  return { id, name: s.name, variant: s.variant, dark: s.colors, light };
}

// ---------------------------------------------------------------------------
// "Glance classics": glance-original presets not present in base16
// (values from glance/docs/themes.md, HSL → hex).
// ---------------------------------------------------------------------------

interface GlanceClassicSpec {
  id: string;
  name: string;
  light?: boolean;
  bg: string;
  primary: string;
  positive?: string;
  negative?: string;
}

const GLANCE_CLASSICS: GlanceClassicSpec[] = [
  { id: 'teal-city', name: 'Teal City', bg: '225 14 15', primary: '157 47 65' },
  { id: 'camouflage', name: 'Camouflage', bg: '186 21 20', primary: '97 13 80' },
  { id: 'tucan', name: 'Tucan', bg: '50 1 6', primary: '24 97 58', negative: '209 88 54' },
  { id: 'neon-pink', name: 'Neon Pink', bg: '240 27 11', primary: '321 100 71', positive: '165 78 51', negative: '360 100 71' },
  { id: 'peachy', name: 'Peachy', light: true, bg: '28 40 77', primary: '155 100 20', negative: '0 100 60' },
  { id: 'zebra', name: 'Zebra', light: true, bg: '0 0 95', primary: '0 0 10', negative: '0 90 50' },
];

function hsl(hs: string, l: number): string {
  const [h, s] = hs.split(/\s+/).map(Number);
  return hslToHex(h, s, l);
}

function bgLightness(spec: GlanceClassicSpec): number {
  return Number(spec.bg.split(' ')[2]);
}

/** Expand a glance theme block into a full base16 palette. Surfaces sit
 * above the page bg (lighten for dark themes, darken for light ones); text
 * derives from the theme's light/dark polarity; accents pass through. */
function glanceClassicToColors(spec: GlanceClassicSpec): Base16Colors {
  const isLight = spec.light === true;
  const step = isLight ? -5 : 5;
  const base = bgLightness(spec);
  const lift = (offset: number) => Math.max(4, Math.min(96, base + offset));
  const textL = isLight ? 12 : 88;
  const mutedL = isLight ? 35 : 65;
  return {
    base00: hsl(spec.bg, base),
    base01: hsl(spec.bg, lift(step)),
    base02: hsl(spec.bg, lift(step * 2)),
    base03: hsl(spec.bg, lift(step * 3)),
    base04: hsl(spec.bg, mutedL),
    base05: hsl(spec.bg, textL),
    base06: hsl(spec.bg, isLight ? 75 : 80),
    base07: isLight ? '#ffffff' : '#000000',
    base08: spec.negative ? hsl(spec.negative, 60) : '#d64958',
    base09: '#d98b3d',
    base0A: '#d9b23d',
    base0B: spec.positive ? hsl(spec.positive, 55) : '#5a9e6f',
    base0C: '#4f9e9e',
    base0D: hsl(spec.primary, 55),
    base0E: '#8a6fc0',
    base0F: '#9e7b5a',
  };
}

const glanceClassics: Preset[] = GLANCE_CLASSICS.map((spec) => {
  const colors = glanceClassicToColors(spec);
  const isLight = spec.light === true;
  return {
    id: spec.id,
    name: spec.name,
    variant: isLight ? 'light' : 'dark',
    dark: isLight ? invertLuminance(colors) : colors,
    light: isLight ? colors : undefined,
  };
});

export const presets: Preset[] = [...presetsFromSchemes, ...glanceClassics];

export function presetById(id: string): Preset {
  return presets.find((p) => p.id === id) ?? presets[0];
}

/** For tests: every role key that must exist in a palette. */
export const BASE16_KEYS: Base16Key[] = [
  'base00', 'base01', 'base02', 'base03', 'base04', 'base05', 'base06', 'base07',
  'base08', 'base09', 'base0A', 'base0B', 'base0C', 'base0D', 'base0E', 'base0F',
];
