/**
 * Pure HSL ramp math — a faithful port of glance's `main.css` scheme
 * formulas. Every color derives from the page background lightness (plus a
 * fixed set of deltas) and the background hue/saturation, so one hue drives
 * the whole visual layer. See glance/internal/glance/static/css/main.css.
 */

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

/** The 20 glance color roles, emitted as `hsl(h s% l%)` strings. */
export interface GlanceRamp {
  background: string;
  widgetBackground: string;
  widgetContentBorder: string;
  widgetBackgroundHighlight: string;
  separator: string;
  popoverBackground: string;
  popoverBorder: string;
  progressBorder: string;
  progressValue: string;
  verticalProgressValue: string;
  graphGridlines: string;
  widgetShadow: string;
  textHighlight: string;
  textParagraph: string;
  textBase: string;
  textBaseMuted: string;
  textSubdue: string;
  primary: string;
  positive: string;
  negative: string;
}

function clamp(v: number, max: number): number {
  return Math.max(0, Math.min(max, v));
}

function fmt(v: number): string {
  return String(Math.round(v * 100) / 100);
}

function hslStr(h: number, s: number, l: number): string {
  return `hsl(${fmt(h)} ${fmt(s)}% ${fmt(l)}%)`;
}

/**
 * Build a glance ramp. `light` flips the sign of every surface delta and
 * inverts the text ramp (dark text on light page); the accent blocks pass
 * through untouched, matching glance's `--scheme` behavior.
 *
 * contrast-multiplier / text-saturation-multiplier are accepted for config
 * compat but intentionally ignored (user decision — no dynamic contrast
 * scaling; glance's multipliers are not surfaced).
 */
export function glanceRamp(
  bg: Hsl,
  primary: Hsl,
  negative: Hsl,
  positive: Hsl,
  light: boolean,
): GlanceRamp {
  // dark: additive deltas, light: subtractive (glance --scheme negation)
  const sign = light ? -1 : 1;
  const lift = (delta: number) => clamp(bg.l + delta * sign, 100);
  const textL = (level: number) => clamp(light ? 100 - level : level, 100);
  const same = (c: Hsl) => hslStr(c.h, c.s, c.l);
  return {
    background: same(bg),
    widgetBackground: hslStr(bg.h, bg.s, clamp(bg.l + 1, 100)),
    widgetContentBorder: hslStr(bg.h, bg.s, lift(4)),
    widgetBackgroundHighlight: hslStr(bg.h, bg.s, lift(4)),
    separator: hslStr(bg.h, bg.s, lift(4)),
    // glance does NOT scheme the popover: it is always l+3, s+3
    popoverBackground: hslStr(bg.h, clamp(bg.s + 3, 100), clamp(bg.l + 3, 100)),
    popoverBorder: hslStr(bg.h, bg.s, lift(12)),
    progressBorder: hslStr(bg.h, bg.s, lift(10)),
    progressValue: hslStr(bg.h, bg.s, lift(26)),
    verticalProgressValue: hslStr(bg.h, bg.s, lift(28)),
    graphGridlines: hslStr(bg.h, bg.s, lift(6)),
    // widget shadow sits just off the page bg, darker in dark mode
    widgetShadow: hslStr(bg.h, bg.s, clamp(bg.l + (light ? 0.5 : -0.5), 100)),
    // text: saturation follows the background (--ths), lightness from the
    // glance levels 85/73/58/52/35, inverted for light pages
    textHighlight: hslStr(bg.h, bg.s, textL(85)),
    textParagraph: hslStr(bg.h, bg.s, textL(73)),
    textBase: hslStr(bg.h, bg.s, textL(58)),
    textBaseMuted: hslStr(bg.h, bg.s, textL(52)),
    textSubdue: hslStr(bg.h, bg.s, textL(35)),
    primary: same(primary),
    positive: same(positive),
    negative: same(negative),
  };
}
