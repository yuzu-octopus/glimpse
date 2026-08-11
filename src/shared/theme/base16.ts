/** Base16 color roles (tinted-theming spec): 8-step grayscale ramp
 * base00 (darkest bg) → base07 (lightest) + 8 accents base08–base0F. */

export type Base16Key =
  | 'base00' | 'base01' | 'base02' | 'base03'
  | 'base04' | 'base05' | 'base06' | 'base07'
  | 'base08' | 'base09' | 'base0A' | 'base0B'
  | 'base0C' | 'base0D' | 'base0E' | 'base0F';

export type Base16Colors = Record<Base16Key, string>;

export interface Base16Scheme {
  id: string;
  name: string;
  author: string;
  variant: 'dark' | 'light';
  colors: Base16Colors;
}

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function hexToRgb(hex: string): [number, number, number] {
  const m = HEX_RE.exec(hex);
  if (!m) throw new Error(`invalid hex color: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

/**
 * Derive the opposite-mode side of a single-variant scheme by inverting
 * lightness (perceptual complement around 50%, clamped 6–94). Hue and
 * saturation are preserved, so dark schemes yield usable light counterparts.
 */
export function invertLuminance(colors: Base16Colors): Base16Colors {
  const out = {} as Base16Colors;
  for (const key of Object.keys(colors) as Base16Key[]) {
    const [r, g, b] = hexToRgb(colors[key]);
    const [h, s, l] = rgbToHsl(r, g, b);
    const inv = Math.max(6, Math.min(94, 100 - l));
    out[key] = hslToHex(h, s, inv);
  }
  return out;
}

/** Convert HSL (h: 0–360, s/l: 0–100) to a #rrggbb hex string. */
export function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100, ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) =>
    ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}
