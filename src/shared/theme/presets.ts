import type { Base16Colors, Base16Key } from './base16';
import { hslToHex, invertLuminance } from './base16';
import { hslSeedToColors } from './glanceHsl';
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

function hslTriple(hs: string): { h: number; s: number; l: number } {
  const [h, s, l] = hs.split(/\s+/).map(Number);
  return { h, s, l };
}

/** Expand a glance theme block into a full base16 palette via the shared
 * HSL-seed core. Specs that omit a color keep the classic literal-hex
 * fallbacks (not the config-block documented defaults). */
function glanceClassicToColors(spec: GlanceClassicSpec): Base16Colors {
  return hslSeedToColors({
    bg: hslTriple(spec.bg),
    primary: hslTriple(spec.primary),
    positiveHex: spec.positive ? hsl(spec.positive, 55) : '#5a9e6f',
    negativeHex: spec.negative ? hsl(spec.negative, 60) : '#d64958',
    light: spec.light,
  });
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
