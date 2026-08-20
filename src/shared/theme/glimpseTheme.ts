/**
 * Theme sources + the glance→Astryx theme builder.
 *
 * A ThemeSource is the seed data for one mode: background + accent blocks
 * in HSL. `buildGlimpseTheme` runs the glance ramp for both modes and maps
 * the resulting colors onto glance CSS vars AND Astryx semantic tokens.
 *
 * Semantic colour mapping (data-driven, flat minimal — ui-ux-pro-max + Astryx):
 *  Primitives (dracula hex) → Semantic tokens → Component usage
 *  ─────────────────────────────────────────────────────────────
 *  Purple  #bd93f9  --color-primary / --color-tag-blue / --color-accent / --color-text-accent
 *           = Links & titles (unvisited). Visited → --color-text-base, hover → primary + underline.
 *           All .title / .cardTitle / .linkTitle unvisited MUST use primary so user learns “purple = tappable title”.
 *  Green   #50fa7b  --color-positive / --color-success / --color-tag-green
 *           = Positive / success (monitor .dotUp, markets .up, scores/points, +change).
 *  Red     #ff5555  --color-negative / --color-error
 *           = Negative / error (monitor .dotDown, markets .down).
 *  Orange  #ffb86c  --color-tag-orange / --color-orange
 *           = Warning / attention (secondary score accent when green reserved — now unified to green).
 *  Yellow  #f1fa8c  --color-warning / --color-tag-yellow
 *           = Tags / chips (rss .chip, releases .tag — 5-way cycle, yellow is first).
 *  Cyan    #8be9fd  --color-info / --color-tag-cyan / --color-accent-muted
 *           = Info / secondary links (HN/Lobsters .metaLink, bookmarks subtle).
 *  Pink    #ff79c6  --color-tag-pink / --color-magenta
 *           = Accent / flair (reddit .flair, bookmarks icon nth-cycle).
 *  Subdued            --color-text-subdue / --color-separator
 *           = Metadata / separators (•, timestamps, borders).
 *  Keep the mapping in sync with src/index.css :root fallbacks and glanceColorVars() below.
 *  Astryx: defineTheme tokens are [light, dark] tuples → light-dark() — see @astryxdesign/core/theme defineTheme.
 */
import {
  defineTheme,
  type DefinedTheme,
  type TokenValue,
} from '@astryxdesign/core/theme';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';
import { hexToRgb, invertLuminance, rgbToHsl, type Base16Colors } from './base16';
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
  warning: Hsl;
  success: Hsl;
  info: Hsl;
  magenta: Hsl;
  orange: Hsl;
}

export interface ThemeSourcePair {
  dark: ThemeSource;
  light: ThemeSource;
}

/** Derive a source from a base16 palette: bg=base00, primary=base0D,
 * negative=base08, positive=base0B, warning=base0A, info=base0C,
 * magenta=base0E, orange=base09. For dracula this is:
 * purple #bd93f9 / red #ff5555 / green #50fa7b / yellow #f1fa8c /
 * cyan #8be9fd / pink #ff79c6 / orange #ffb86c — all 7 hues surface
 * distinctly instead of collapsing to just blues/purples. */
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
  const hslOf = (key: keyof Base16Colors): Hsl => {
    const [r, g, b] = hexToRgb(colors[key]);
    return toHsl(r, g, b);
  };
  return {
    id,
    name,
    variant,
    bg: hslOf('base00'),
    primary: hslOf('base0D'),
    negative: hslOf('base08'),
    positive: hslOf('base0B'),
    warning: hslOf('base0A'),
    success: hslOf('base0B'),
    info: hslOf('base0C'),
    magenta: hslOf('base0E'),
    orange: hslOf('base09'),
  };
}

/** Glance documented fallbacks (docs/configuration.md §Theme). */
const DEFAULT_PRIMARY: Hsl = { h: 43, s: 50, l: 70 };
const DEFAULT_NEGATIVE: Hsl = { h: 0, s: 70, l: 70 };
const DEFAULT_WARNING: Hsl = { h: 45, s: 100, l: 70 };
const DEFAULT_SUCCESS: Hsl = { h: 135, s: 94, l: 66 };
const DEFAULT_INFO: Hsl = { h: 191, s: 97, l: 77 };
const DEFAULT_MAGENTA: Hsl = { h: 326, s: 100, l: 74 };
const DEFAULT_ORANGE: Hsl = { h: 24, s: 100, l: 65 };

export function sourceFromHslBlock(
  id: string,
  name: string,
  bg: Hsl,
  primary: Hsl = DEFAULT_PRIMARY,
  negative: Hsl = DEFAULT_NEGATIVE,
  positive?: Hsl,
  variant: 'dark' | 'light' = 'dark',
): ThemeSource {
  const pos = positive ?? DEFAULT_SUCCESS;
  return {
    id,
    name,
    variant,
    bg,
    primary,
    negative,
    positive: pos,
    warning: DEFAULT_WARNING,
    success: pos,
    info: DEFAULT_INFO,
    magenta: DEFAULT_MAGENTA,
    orange: DEFAULT_ORANGE,
  };
}

/** Dark side from preset.dark; light side from preset.light when the family
 * ships one, else derive light via luminance inversion so light mode is
 * actually light for dark-only presets (dracula etc). */
export function sourcePairFromPreset(preset: Preset): ThemeSourcePair {
  const dark = sourceFromBase16(preset.id, preset.name, preset.dark, 'dark');
  const light = preset.light
    ? sourceFromBase16(preset.id, preset.name, preset.light, 'light')
    : sourceFromBase16(preset.id, preset.name, invertLuminance(preset.dark), 'light');
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
  const hslStr = (c: Hsl) => `hsl(${Math.round(c.h * 100) / 100} ${Math.round(c.s * 100) / 100}% ${Math.round(c.l * 100) / 100}%)`;
  const onFor = (c: Hsl) => (c.l >= 55 ? '#000000' : '#FFFFFF');
  const onAccentLight = onFor(pair.light.primary);
  const onAccentDark = onFor(pair.dark.primary);
  const onSuccessLight = onFor(pair.light.success);
  const onSuccessDark = onFor(pair.dark.success);
  const onWarningLight = onFor(pair.light.warning);
  const onWarningDark = onFor(pair.dark.warning);

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
    '--color-accent-muted': tuple(hslStr(pair.light.info), hslStr(pair.dark.info)),
    '--color-success': tuple(hslStr(pair.light.success), hslStr(pair.dark.success)),
    '--color-error': tuple(light.negative, dark.negative),
    '--color-warning': tuple(hslStr(pair.light.warning), hslStr(pair.dark.warning)),
    '--color-info': tuple(hslStr(pair.light.info), hslStr(pair.dark.info)),
    '--color-tag-orange': tuple(hslStr(pair.light.orange), hslStr(pair.dark.orange)),
    '--color-tag-magenta': tuple(hslStr(pair.light.magenta), hslStr(pair.dark.magenta)),
    '--color-tag-cyan': tuple(hslStr(pair.light.info), hslStr(pair.dark.info)),
    '--color-tag-yellow': tuple(hslStr(pair.light.warning), hslStr(pair.dark.warning)),
    '--color-tag-green': tuple(hslStr(pair.light.success), hslStr(pair.dark.success)),
    '--color-tag-blue': tuple(light.primary, dark.primary),
    '--color-tag-pink': tuple(hslStr(pair.light.magenta), hslStr(pair.dark.magenta)),
    '--color-orange': tuple(hslStr(pair.light.orange), hslStr(pair.dark.orange)),
    '--color-magenta': tuple(hslStr(pair.light.magenta), hslStr(pair.dark.magenta)),
    '--color-track': tuple(light.widgetBackgroundHighlight, dark.widgetBackgroundHighlight),
    '--color-skeleton': tuple(light.widgetContentBorder, dark.widgetContentBorder),
    '--color-on-accent': tuple(onAccentLight, onAccentDark),
    '--color-on-success': tuple(onSuccessLight, onSuccessDark),
    '--color-on-warning': tuple(onWarningLight, onWarningDark),
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
