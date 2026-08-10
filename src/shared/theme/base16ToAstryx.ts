import { defineTheme, type DefinedTheme } from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import type { Base16Colors } from './base16';

/** base16 accents → astryx hue token families (verified against
 * @astryxdesign/core dist/theme/tokens.stylex.js). */
const HUE_FAMILIES = [
  ['base08', 'red'],
  ['base09', 'orange'],
  ['base0A', 'yellow'],
  ['base0B', 'green'],
  ['base0C', 'cyan'],
  ['base0D', 'blue'],
  ['base0E', 'purple'],
] as const;

type TokenMap = Record<string, [string, string]>;

/**
 * Map a base16 palette pair onto Astryx tokens. Values are [light, dark]
 * tuples; Astryx compiles them to light-dark() so a single Theme object
 * serves both modes. All role names are verified core tokens.
 */
export function buildTheme(
  name: string,
  light: Base16Colors,
  dark: Base16Colors,
): DefinedTheme {
  const tokens: TokenMap = {
    // surface ramp
    '--color-background-body': [light.base00, dark.base00],
    '--color-background-surface': [light.base01, dark.base01],
    '--color-background-card': [light.base02, dark.base02],
    '--color-background-popover': [light.base02, dark.base02],
    '--color-background-muted': [light.base03, dark.base03],
    '--color-border': [light.base03, dark.base03],
    '--color-border-emphasized': [light.base04, dark.base04],
    // text
    '--color-text-secondary': [light.base04, dark.base04],
    '--color-text-primary': [light.base05, dark.base05],
    '--color-text-disabled': [light.base03, dark.base03],
    // accent
    '--color-accent': [light.base0D, dark.base0D],
    '--color-accent-muted': [light.base0D, dark.base0D],
    '--color-text-accent': [light.base0D, dark.base0D],
    '--color-icon-accent': [light.base0D, dark.base0D],
    // status
    '--color-success': [light.base0B, dark.base0B],
    '--color-error': [light.base08, dark.base08],
    '--color-warning': [light.base0A, dark.base0A],
  };

  for (const [baseKey, hue] of HUE_FAMILIES) {
    tokens[`--color-text-${hue}`] = [light[baseKey], dark[baseKey]];
    tokens[`--color-icon-${hue}`] = [light[baseKey], dark[baseKey]];
    tokens[`--color-border-${hue}`] = [light[baseKey], dark[baseKey]];
    tokens[`--color-background-${hue}`] = [
      `${light[baseKey]}33`,
      `${dark[baseKey]}33`,
    ];
  }

  return defineTheme({ name, extends: neutralTheme, tokens });
}
