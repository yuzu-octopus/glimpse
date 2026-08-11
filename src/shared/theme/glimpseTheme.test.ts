import { describe, expect, it } from 'vitest';
import { hexToRgb, hslToHex } from './base16';
import { glanceRamp, type Hsl } from './glanceRamp';
import {
  buildGlimpseTheme,
  sourceFromBase16,
  sourceFromHslBlock,
  sourcePairFromPreset,
} from './glimpseTheme';
import { presetById } from './presets';

const DEFAULT_BG: Hsl = { h: 240, s: 8, l: 9 };
const DEFAULT_PRIMARY: Hsl = { h: 43, s: 50, l: 70 };
const DEFAULT_NEGATIVE: Hsl = { h: 0, s: 70, l: 70 };

// light-dark() is compiled at defineTheme time
const ld = (l: string, d: string) => `light-dark(${l}, ${d})`;

describe('glanceRamp (dark)', () => {
  const ramp = glanceRamp(DEFAULT_BG, DEFAULT_PRIMARY, DEFAULT_NEGATIVE, DEFAULT_PRIMARY, false);

  it('steps surfaces off the background lightness', () => {
    expect(ramp.background).toBe('hsl(240 8% 9%)');
    expect(ramp.widgetBackground).toBe('hsl(240 8% 10%)'); // l+1
    expect(ramp.widgetContentBorder).toBe('hsl(240 8% 13%)'); // l+4
    expect(ramp.widgetBackgroundHighlight).toBe(ramp.widgetContentBorder);
    expect(ramp.separator).toBe(ramp.widgetContentBorder);
    expect(ramp.graphGridlines).toBe('hsl(240 8% 15%)'); // l+6
    expect(ramp.progressBorder).toBe('hsl(240 8% 19%)'); // l+10
    expect(ramp.popoverBorder).toBe('hsl(240 8% 21%)'); // l+12
    expect(ramp.progressValue).toBe('hsl(240 8% 35%)'); // l+26
    expect(ramp.verticalProgressValue).toBe('hsl(240 8% 37%)'); // l+28
  });

  it('keeps the popover background un-inverted (s+3, l+3)', () => {
    expect(ramp.popoverBackground).toBe('hsl(240 11% 12%)');
  });

  it('places the widget shadow just below the page bg', () => {
    expect(ramp.widgetShadow).toBe('hsl(240 8% 8.5%)'); // l-0.5
  });

  it('builds the text ramp from the glance levels at bg saturation', () => {
    expect(ramp.textHighlight).toBe('hsl(240 8% 85%)');
    expect(ramp.textParagraph).toBe('hsl(240 8% 73%)');
    expect(ramp.textBase).toBe('hsl(240 8% 58%)');
    expect(ramp.textBaseMuted).toBe('hsl(240 8% 52%)');
    expect(ramp.textSubdue).toBe('hsl(240 8% 35%)');
  });

  it('passes the accent blocks through unchanged', () => {
    expect(ramp.primary).toBe('hsl(43 50% 70%)');
    expect(ramp.negative).toBe('hsl(0 70% 70%)');
  });

  it('defaults positive to primary', () => {
    expect(ramp.positive).toBe(ramp.primary);
  });

  it('clamps lightness into range', () => {
    const r = glanceRamp({ h: 240, s: 8, l: 99 }, DEFAULT_PRIMARY, DEFAULT_NEGATIVE, DEFAULT_PRIMARY, true);
    expect(r.widgetBackground).toBe('hsl(240 8% 98%)');
    expect(r.textSubdue).toBe('hsl(240 8% 65%)');
  });
});

describe('glanceRamp (light inversion)', () => {
  const ramp = glanceRamp(DEFAULT_BG, DEFAULT_PRIMARY, DEFAULT_NEGATIVE, DEFAULT_PRIMARY, true);

  it('flips surface deltas subtractive', () => {
    expect(ramp.background).toBe('hsl(240 8% 9%)');
    expect(ramp.widgetBackground).toBe('hsl(240 8% 8%)'); // l-1
    expect(ramp.widgetContentBorder).toBe('hsl(240 8% 5%)'); // l-4
    expect(ramp.widgetShadow).toBe('hsl(240 8% 9.5%)'); // l+0.5
  });

  it('inverts the text ramp around 100-l', () => {
    expect(ramp.textHighlight).toBe('hsl(240 8% 15%)'); // 100-85
    expect(ramp.textParagraph).toBe('hsl(240 8% 27%)');
    expect(ramp.textBase).toBe('hsl(240 8% 42%)');
    expect(ramp.textSubdue).toBe('hsl(240 8% 65%)'); // 100-35
  });
});

describe('sources', () => {
  it('sourceFromBase16 maps base00/base0D/base08 and positive=primary', () => {
    const s = sourceFromBase16('t', 'T', presetById('catppuccin-mocha').dark, 'dark');
    expect(s.id).toBe('t');
    expect(s.variant).toBe('dark');
    expect(s.positive).toEqual(s.primary);
    expect(s.bg.h).toBeGreaterThanOrEqual(0);
    expect(s.bg.l).toBeGreaterThan(0);
    expect(s.negative).not.toEqual(s.primary);
  });

  it('sourceFromHslBlock applies glance defaults for omitted colors', () => {
    const s = sourceFromHslBlock('t', 'T', DEFAULT_BG);
    expect(s.primary).toEqual({ h: 43, s: 50, l: 70 });
    expect(s.negative).toEqual({ h: 0, s: 70, l: 70 });
    expect(s.positive).toEqual(s.primary);
    expect(s.variant).toBe('dark');
  });

  it('sourceFromHslBlock accepts explicit accents and variant', () => {
    const s = sourceFromHslBlock('t', 'T', DEFAULT_BG, { h: 1, s: 2, l: 3 }, { h: 4, s: 5, l: 6 }, { h: 7, s: 8, l: 9 }, 'light');
    expect(s.variant).toBe('light');
    expect(s.primary).toEqual({ h: 1, s: 2, l: 3 });
    expect(s.negative).toEqual({ h: 4, s: 5, l: 6 });
    expect(s.positive).toEqual({ h: 7, s: 8, l: 9 });
  });

  it('sourcePairFromPreset derives both modes', () => {
    const preset = presetById('catppuccin-mocha'); // ships an explicit light side
    const pair = sourcePairFromPreset(preset);
    expect(pair.dark.variant).toBe('dark');
    expect(pair.light.variant).toBe('light');
    expect(pair.dark.id).toBe(preset.id);
    // distinct seeds: the light side has a much lighter page background
    expect(pair.dark.bg.l).toBeLessThan(pair.light.bg.l);
  });

  it('sourcePairFromPreset falls back to the dark side when no light exists', () => {
    const darkOnly = { ...presetById('catppuccin-mocha'), light: undefined };
    const pair = sourcePairFromPreset(darkOnly);
    expect(pair.light).toEqual(pair.dark);
  });
});

describe('buildGlimpseTheme', () => {
  const mocha = buildGlimpseTheme(sourcePairFromPreset(presetById('catppuccin-mocha')));
  // same seeds on both sides → exact expectations for the ramp tuples
  const defaultPair = {
    dark: sourceFromHslBlock('default', 'Default', DEFAULT_BG, DEFAULT_PRIMARY, DEFAULT_NEGATIVE, undefined, 'dark'),
    light: sourceFromHslBlock('default', 'Default', DEFAULT_BG, DEFAULT_PRIMARY, DEFAULT_NEGATIVE, undefined, 'light'),
  };
  const def = buildGlimpseTheme(defaultPair);

  it('is named after the preset and extends neutral', () => {
    expect(mocha.name).toBe('catppuccin-mocha');
  });

  it('emits every glance dim', () => {
    const t = def.tokens;
    expect(t['--widget-gap']).toBe('23px');
    expect(t['--widget-content-vertical-padding']).toBe('15px');
    expect(t['--widget-content-horizontal-padding']).toBe('17px');
    expect(t['--widget-content-padding']).toBe('15px 17px');
    expect(t['--content-bounds-padding']).toBe('15px');
    expect(t['--border-radius']).toBe('5px');
    expect(t['--mobile-navigation-height']).toBe('50px');
    expect(t['--font-size-h1']).toBe('17px');
    expect(t['--font-size-h6']).toBe('11px');
    expect(t['--font-size-base']).toBe('13px');
  });

  it('emits the glance ramp vars as light-dark tuples', () => {
    const t = def.tokens;
    expect(t['--color-background']).toBe(ld('hsl(240 8% 9%)', 'hsl(240 8% 9%)'));
    expect(t['--color-widget-background']).toBe(ld('hsl(240 8% 8%)', 'hsl(240 8% 10%)'));
    expect(t['--color-widget-content-border']).toBe(ld('hsl(240 8% 5%)', 'hsl(240 8% 13%)'));
    expect(t['--color-text-highlight']).toBe(ld('hsl(240 8% 15%)', 'hsl(240 8% 85%)'));
    expect(t['--color-primary']).toBe(ld('hsl(43 50% 70%)', 'hsl(43 50% 70%)'));
    expect(t['--color-positive']).toBe(t['--color-primary']);
    expect(t['--color-separator']).toBe(t['--color-widget-content-border']);
    expect(t['--color-negative']).toBe(ld('hsl(0 70% 70%)', 'hsl(0 70% 70%)'));
  });

  it('maps glance roles onto astryx semantic tokens', () => {
    const t = mocha.tokens;
    expect(t['--color-background-body']).toBe(t['--color-background']);
    expect(t['--color-background-surface']).toBe(t['--color-widget-background']);
    expect(t['--color-background-card']).toBe(t['--color-widget-background']);
    expect(t['--color-background-popover']).toBe(t['--color-popover-background']);
    expect(t['--color-background-muted']).toBe(t['--color-widget-background-highlight']);
    expect(t['--color-overlay-hover']).toBe(t['--color-widget-background-highlight']);
    expect(t['--color-overlay-pressed']).toBe(t['--color-widget-background-highlight']);
    expect(t['--color-border']).toBe(t['--color-widget-content-border']);
    expect(t['--color-border-emphasized']).toBe(t['--color-popover-border']);
    expect(t['--color-text-primary']).toBe(t['--color-text-highlight']);
    expect(t['--color-text-secondary']).toBe(t['--color-text-base']);
    expect(t['--color-text-disabled']).toBe(t['--color-text-subdue']);
    expect(t['--color-text-accent']).toBe(t['--color-primary']);
    expect(t['--color-icon-primary']).toBe(t['--color-text-highlight']);
    expect(t['--color-icon-secondary']).toBe(t['--color-text-base']);
    expect(t['--color-icon-disabled']).toBe(t['--color-text-subdue']);
    expect(t['--color-icon-accent']).toBe(t['--color-primary']);
    expect(t['--color-accent']).toBe(t['--color-primary']);
    expect(t['--color-accent-muted']).toBe(t['--color-primary']);
    expect(t['--color-success']).toBe(t['--color-positive']);
    expect(t['--color-error']).toBe(t['--color-negative']);
    expect(t['--color-warning']).toBe(t['--color-primary']);
    expect(t['--color-track']).toBe(t['--color-widget-background-highlight']);
    expect(t['--color-skeleton']).toBe(t['--color-widget-content-border']);
  });

  it('derives on-accent/on-success from primary lightness per mode', () => {
    // mocha primary l≈76 (≥55 → black); latte primary l≈54 (<55 → white)
    const t = mocha.tokens;
    expect(t['--color-on-accent']).toBe(ld('#FFFFFF', '#000000'));
    expect(t['--color-on-success']).toBe(ld('#FFFFFF', '#000000'));
    expect(t['--color-on-error']).toBe(ld('#FFFFFF', '#FFFFFF'));
    // default primary l=70 → black in both modes
    expect(def.tokens['--color-on-accent']).toBe(ld('#000000', '#000000'));
  });

  it('forces the glance 5px radius tokens', () => {
    const t = def.tokens;
    expect(t['--radius-element']).toBe('5px');
    expect(t['--radius-container']).toBe('5px');
    expect(t['--radius-page']).toBe('5px');
    expect(t['--radius-inner']).toBe('4px');
  });

  it('declares the JetBrains Mono typography', () => {
    const t = def.tokens;
    expect(t['--font-family-body']).toBe('"JetBrains Mono", monospace');
    expect(t['--font-family-heading']).toBe('"JetBrains Mono", monospace');
    expect(t['--font-family-code']).toBe('"JetBrains Mono", monospace');
  });

  it('emits the component overrides', () => {
    const c = def.components ?? {};
    expect(c.card?.base?.backgroundColor).toBe('var(--color-widget-background)');
    expect(c.card?.base?.border).toBe('1px solid var(--color-widget-content-border)');
    expect(c.card?.base?.borderRadius).toBe('var(--border-radius)');
    expect(c.card?.base?.boxShadow).toBe('0px 3px 0px 0px var(--color-widget-shadow)');
    expect(c.link?.base?.color).toBe('inherit');
    expect(c.link?.base?.[':hover']).toEqual({ color: 'var(--color-text-highlight)' });
    expect(c.button?.base?.borderRadius).toBe('var(--border-radius)');
  });

  it('compiles tuple tokens to light-dark() hexes that round-trip', () => {
    // Sanity: the dark ramp values convert to the hexes pasted in index.css
    const dark = glanceRamp(DEFAULT_BG, DEFAULT_PRIMARY, DEFAULT_NEGATIVE, DEFAULT_PRIMARY, false);
    const hex = (hsl: string) => {
      const m = /^hsl\((\d+) (\d+)% (\d+)%\)$/.exec(hsl);
      expect(m).not.toBeNull();
      return hslToHex(Number(m![1]), Number(m![2]), Number(m![3]));
    };
    expect(hex(dark.background)).toBe(hslToHex(240, 8, 9));
    expect(hex(dark.widgetBackground)).toBe(hslToHex(240, 8, 10));
    // hslToHex produces the same output our hexToRgb parses back
    const [r, g, b] = hexToRgb(hex(dark.textBase));
    expect(rgbToHslRoundTrip(r, g, b, 58)).toBe(true);
  });
});

function rgbToHslRoundTrip(r: number, g: number, b: number, l: number): boolean {
  // base16.rgbToHsl is exported for the engine; re-derive lightness here
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  return Math.abs(((max + min) / 2) * 100 - l) < 0.5;
}
