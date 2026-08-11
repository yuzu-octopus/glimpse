/**
 * Theme sources + the glance→Astryx theme builder.
 *
 * A ThemeSource is the seed data for one mode: background + accent blocks
 * in HSL. `buildGlimpseTheme` runs the glance ramp for both modes and maps
 * the resulting colors onto glance CSS vars AND Astryx semantic tokens.
 */
import {
  defineTheme,
  type DefinedTheme,
  type TokenValue,
} from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { hexToRgb, rgbToHsl, type Base16Colors } from './base16';
import { glanceRamp, type GlanceRamp, type Hsl } from './glanceRamp';
import type { Preset } from './presets';

export interface ThemeSource {
  id: string;
  name: string;
  variant: 'dark' | 'light';
  bg: Hsl;
  primary: Hsl;
  negative: Hsl;
  positive: Hsl;
}

export interface ThemeSourcePair {
  dark: ThemeSource;
  light: ThemeSource;
}

/** Derive a source from a base16 palette: bg=base00, primary=base0D,
 * negative=base08, positive defaults to primary (glance has no green). */
export function sourceFromBase16(
  id: string,
  name: string,
  colors: Base16Colors,
  variant: 'dark' | 'light',
): ThemeSource {
  const toHsl = (r: number, g: number, b: number): Hsl => {
    const [h, s, l] = rgbToHsl(r, g, b);
    return { h, s, l };
  };
  const [br, bg, bb] = hexToRgb(colors.base00);
  const [pr, pg, pb] = hexToRgb(colors.base0D);
  const [nr, ng, nb] = hexToRgb(colors.base08);
  const primary = toHsl(pr, pg, pb);
  return {
    id,
    name,
    variant,
    bg: toHsl(br, bg, bb),
    primary,
    negative: toHsl(nr, ng, nb),
    positive: primary,
  };
}

/** Glance documented fallbacks (docs/configuration.md §Theme). */
const DEFAULT_PRIMARY: Hsl = { h: 43, s: 50, l: 70 };
const DEFAULT_NEGATIVE: Hsl = { h: 0, s: 70, l: 70 };

export function sourceFromHslBlock(
  id: string,
  name: string,
  bg: Hsl,
  primary: Hsl = DEFAULT_PRIMARY,
  negative: Hsl = DEFAULT_NEGATIVE,
  positive?: Hsl,
  variant: 'dark' | 'light' = 'dark',
): ThemeSource {
  return {
    id,
    name,
    variant,
    bg,
    primary,
    negative,
    positive: positive ?? primary,
  };
}

/** Dark side from preset.dark; light side from preset.light when the family
 * ships one, else the dark side itself. */
export function sourcePairFromPreset(preset: Preset): ThemeSourcePair {
  const dark = sourceFromBase16(preset.id, preset.name, preset.dark, 'dark');
  const light = preset.light
    ? sourceFromBase16(preset.id, preset.name, preset.light, 'light')
    : dark;
  return { dark, light };
}

/** Glance dimension vars — same in both modes, emitted as plain strings. */
const DIMS: Record<string, string> = {
  '--widget-gap': '23px',
  '--widget-content-vertical-padding': '15px',
  '--widget-content-horizontal-padding': '17px',
  '--widget-content-padding': '15px 17px',
  '--content-bounds-padding': '15px',
  '--border-radius': '5px',
  '--mobile-navigation-height': '50px',
  '--font-size-h1': '17px',
  '--font-size-h2': '16px',
  '--font-size-h3': '15px',
  '--font-size-h4': '14px',
  '--font-size-base': '13px',
  '--font-size-h5': '12px',
  '--font-size-h6': '11px',
};

/** camelKey → glance CSS var name (--color-kebab). */
const RAMP_VARS: ReadonlyArray<readonly [keyof GlanceRamp, string]> = [
  ['background', '--color-background'],
  ['widgetBackground', '--color-widget-background'],
  ['widgetContentBorder', '--color-widget-content-border'],
  ['widgetBackgroundHighlight', '--color-widget-background-highlight'],
  ['separator', '--color-separator'],
  ['popoverBackground', '--color-popover-background'],
  ['popoverBorder', '--color-popover-border'],
  ['progressBorder', '--color-progress-border'],
  ['progressValue', '--color-progress-value'],
  ['verticalProgressValue', '--color-vertical-progress-value'],
  ['graphGridlines', '--color-graph-gridlines'],
  ['widgetShadow', '--color-widget-shadow'],
  ['textHighlight', '--color-text-highlight'],
  ['textParagraph', '--color-text-paragraph'],
  ['textBase', '--color-text-base'],
  ['textBaseMuted', '--color-text-base-muted'],
  ['textSubdue', '--color-text-subdue'],
  ['primary', '--color-primary'],
  ['positive', '--color-positive'],
  ['negative', '--color-negative'],
];

/** [light, dark] tuple source for Astryx light-dark() compilation. */
const tuple = (light: string, dark: string): [string, string] => [light, dark];

/**
 * Every themed color var as [light, dark] tuples (glance ramp + Astryx
 * semantic mapping). Shared by buildGlimpseTheme (via defineTheme tokens)
 * and the provider's documentElement sync — the latter guarantees the
 * html/body level (which sits OUTSIDE the Astryx Theme wrapper's scope)
 * resolves theme colors instead of the :root fallbacks.
 */
export function glanceColorVars(
  pair: ThemeSourcePair,
): Record<string, [string, string]> {
  const dark = glanceRamp(
    pair.dark.bg,
    pair.dark.primary,
    pair.dark.negative,
    pair.dark.positive,
    false,
  );
  const light = glanceRamp(
    pair.light.bg,
    pair.light.primary,
    pair.light.negative,
    pair.light.positive,
    true,
  );
  const onAccentLight = pair.light.primary.l >= 55 ? '#000000' : '#FFFFFF';
  const onAccentDark = pair.dark.primary.l >= 55 ? '#000000' : '#FFFFFF';

  const out: Record<string, [string, string]> = {};
  for (const [key, cssName] of RAMP_VARS) {
    out[cssName] = tuple(light[key], dark[key]);
  }
  Object.assign(out, {
    '--color-background-body': tuple(light.background, dark.background),
    '--color-background-surface': tuple(light.widgetBackground, dark.widgetBackground),
    '--color-background-card': tuple(light.widgetBackground, dark.widgetBackground),
    '--color-background-popover': tuple(light.popoverBackground, dark.popoverBackground),
    '--color-background-muted': tuple(
      light.widgetBackgroundHighlight,
      dark.widgetBackgroundHighlight,
    ),
    '--color-overlay-hover': tuple(
      light.widgetBackgroundHighlight,
      dark.widgetBackgroundHighlight,
    ),
    '--color-overlay-pressed': tuple(
      light.widgetBackgroundHighlight,
      dark.widgetBackgroundHighlight,
    ),
    '--color-border': tuple(light.widgetContentBorder, dark.widgetContentBorder),
    '--color-border-emphasized': tuple(light.popoverBorder, dark.popoverBorder),
    '--color-text-primary': tuple(light.textHighlight, dark.textHighlight),
    '--color-text-secondary': tuple(light.textBase, dark.textBase),
    '--color-text-disabled': tuple(light.textSubdue, dark.textSubdue),
    '--color-text-accent': tuple(light.primary, dark.primary),
    '--color-icon-primary': tuple(light.textHighlight, dark.textHighlight),
    '--color-icon-secondary': tuple(light.textBase, dark.textBase),
    '--color-icon-disabled': tuple(light.textSubdue, dark.textSubdue),
    '--color-icon-accent': tuple(light.primary, dark.primary),
    '--color-accent': tuple(light.primary, dark.primary),
    '--color-accent-muted': tuple(light.primary, dark.primary),
    '--color-success': tuple(light.positive, dark.positive),
    '--color-error': tuple(light.negative, dark.negative),
    '--color-warning': tuple(light.primary, dark.primary),
    '--color-track': tuple(light.widgetBackgroundHighlight, dark.widgetBackgroundHighlight),
    '--color-skeleton': tuple(light.widgetContentBorder, dark.widgetContentBorder),
    '--color-on-accent': tuple(onAccentLight, onAccentDark),
    '--color-on-success': tuple(onAccentLight, onAccentDark),
    '--color-on-error': tuple('#FFFFFF', '#FFFFFF'),
  });
  return out;
}

export function buildGlimpseTheme(pair: ThemeSourcePair): DefinedTheme {
  const colorTokens = glanceColorVars(pair);

  const tokens: Record<string, TokenValue> = {
    ...DIMS,
    ...colorTokens,
    // Radius: glance is uniformly 5px
    '--radius-inner': '4px',
    '--radius-element': '5px',
    '--radius-container': '5px',
    '--radius-page': '5px',
  };

  return defineTheme({
    name: pair.dark.id,
    extends: neutralTheme,
    tokens,
    typography: {
      scale: { base: 13, ratio: 1.2 },
      body: { family: 'JetBrains Mono', fallbacks: 'monospace' },
      heading: { family: 'JetBrains Mono', fallbacks: 'monospace', weight: 'normal' },
      code: { family: 'JetBrains Mono', fallbacks: 'monospace' },
    },
    components: {
      link: {
        base: {
          color: 'inherit',
          textDecoration: 'none',
          ':hover': { color: 'var(--color-text-highlight)' },
        },
      },
      card: {
        base: {
          backgroundColor: 'var(--color-widget-background)',
          border: '1px solid var(--color-widget-content-border)',
          borderRadius: 'var(--border-radius)',
        },
      },
      button: {
        base: {
          borderRadius: 'var(--border-radius)',
          fontWeight: 'var(--font-weight-normal)',
        },
      },
    },
  });
}
