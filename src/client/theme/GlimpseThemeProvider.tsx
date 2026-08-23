import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { Theme, type ThemeMode } from '@astryxdesign/core/theme';
import { LinkProvider } from '@astryxdesign/core/Link';
import type { ThemeConfig } from '../../shared/config';
import { presetById, type Preset } from '../../shared/theme/presets';
import { buildConfigPresets, parseHsl } from '../../shared/theme/glanceHsl';
import { buildGlimpseTheme, glanceColorVars, sourcePairFromPreset, type ThemeSourcePair } from '../../shared/theme/glimpseTheme';
import type { Hsl } from '../../shared/theme/glanceRamp';
import { useConfig } from '../hooks/useConfig';

const STORAGE_KEY = 'glimpse.theme.v1';
const PAINT_KEY = 'glimpse.paint.v1';

export interface ThemeSettings {
  mode: ThemeMode;
  presetId: string;
  /** Presets declared in config `theme.presets`, added to the picker. */
  configPresets: Preset[];
  setMode: (mode: ThemeMode) => void;
  setPresetId: (id: string) => void;
}

const ThemeSettingsContext = createContext<ThemeSettings | null>(null);

export function useThemeSettings(): ThemeSettings {
  const ctx = useContext(ThemeSettingsContext);
  if (!ctx) throw new Error('useThemeSettings must be used inside GlimpseThemeProvider');
  return ctx;
}

function readStored(): { mode: ThemeMode; presetId: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as { mode?: unknown; presetId?: unknown };
      const mode =
        p.mode === 'light' || p.mode === 'dark' || p.mode === 'system'
          ? p.mode
          : 'system';
      if (typeof p.presetId === 'string') return { mode, presetId: p.presetId };
      return { mode, presetId: 'catppuccin-mocha' };
    }
  } catch {
    // corrupted storage — fall through to defaults
  }
  return { mode: 'system', presetId: 'catppuccin-mocha' };
}

/** Glance documented fallbacks (docs/configuration.md §Theme). */
const FALLBACK_BG: Hsl = { h: 240, s: 8, l: 9 };
const FALLBACK_PRIMARY: Hsl = { h: 43, s: 50, l: 70 };
const FALLBACK_NEGATIVE: Hsl = { h: 0, s: 70, l: 70 };

/**
 * Top-level config `theme` color fields override the active preset's seeds.
 * The authored side (per the `light` flag) takes the block's HSL; the other
 * side keeps the preset pair's own seeds.
 */
function applyConfigTheme(pair: ThemeSourcePair, theme?: ThemeConfig): ThemeSourcePair {
  if (!theme) return pair;
  const declared =
    theme['background-color'] !== undefined ||
    theme['primary-color'] !== undefined ||
    theme['positive-color'] !== undefined ||
    theme['negative-color'] !== undefined;
  if (!declared) return pair;

  const authored = theme.light === true ? 'light' : 'dark';
  const side = pair[authored];
  const parse = (v: string | undefined, fallback: Hsl): Hsl | null =>
    v === undefined ? null : parseHsl(v) ?? fallback;

  const bg = parse(theme['background-color'], FALLBACK_BG) ?? side.bg;
  const primary = parse(theme['primary-color'], FALLBACK_PRIMARY) ?? side.primary;
  const negative = parse(theme['negative-color'], FALLBACK_NEGATIVE) ?? side.negative;
  const positive = parse(theme['positive-color'], primary) ?? side.positive;
  // Keep vibrant:: positive drives success, retain other accents from the preset
  // unless the user explicitly set them (glance only exposes positive, so success
  // follows positive to keep green distinct from primary).
  return { ...pair, [authored]: { ...side, bg, primary, negative, positive, success: positive, warning: side.warning, info: side.info, magenta: side.magenta, orange: side.orange } };
}

/** Injects the YAML custom-css-file contents (glance appends it last). */
function useCustomCss(): string | null {
  const [css, setCss] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/theme')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ customCss?: string | null }>;
      })
      .then((body) => {
        if (!cancelled) setCss(body.customCss ?? null);
      })
      .catch(() => {
        if (!cancelled) setCss(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return css;
}

export function GlimpseThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(readStored);
  const configState = useConfig();
  const customCss = useCustomCss();

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // storage unavailable (private mode) — theme just won't persist
    }
  }, [settings]);

  const configPresets = useMemo(
    () =>
      buildConfigPresets(configState.status === 'ready' ? configState.config.theme : undefined),
    [configState],
  );

  const pair = useMemo(() => {
    const preset =
      configPresets.find((p) => p.id === settings.presetId) ?? presetById(settings.presetId);
    return applyConfigTheme(
      sourcePairFromPreset(preset),
      configState.status === 'ready' ? configState.config.theme : undefined,
    );
  }, [settings.presetId, configState, configPresets]);

  const colorVars = useMemo(() => glanceColorVars(pair), [pair]);
  const theme = useMemo(() => buildGlimpseTheme(pair, colorVars), [pair, colorVars]);

  // Astryx <Theme> already emits light-dark() tokens, but on a wrapper inside
  // #root; this mirror is still needed so the html element itself (page
  // background) resolves the themed vars. Update in place on change; remove
  // only on unmount to avoid bulk-remove-then-readd flash.
  const appliedRef = useRef<string[]>([]);
  useEffect(() => {
    const root = document.documentElement;
    for (const [name, [light, dark]] of Object.entries(colorVars)) {
      root.style.setProperty(name, `light-dark(${light}, ${dark})`);
    }
    appliedRef.current = Object.keys(colorVars);
    try {
      const mode = settings.mode;
      const scheme: 'dark' | 'light' =
        mode === 'system'
          ? window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light'
          : (mode as 'dark' | 'light');
      const bgTuple = colorVars['--color-background'];
      const fgTuple = colorVars['--color-text-base'];
      if (bgTuple && fgTuple) {
        const bg = scheme === 'dark' ? bgTuple[1] : bgTuple[0];
        const fg = scheme === 'dark' ? fgTuple[1] : fgTuple[0];
        localStorage.setItem(PAINT_KEY, JSON.stringify({ scheme, bg, fg }));
        root.style.colorScheme = scheme;
        // Keep the boot-script inline paint in sync — the html element sits
        // outside every themed scope, so a stale inline bg/color survives
        // theme switches (dark strip above the header row).
        root.style.backgroundColor = bg;
        root.style.color = fg;
      }
    } catch {
      // storage or matchMedia unavailable (tests / private mode)
    }
  }, [colorVars, settings.mode]);
  useEffect(() => {
    return () => {
      const root = document.documentElement;
      for (const name of appliedRef.current) root.style.removeProperty(name);
    };
  }, []);

  const api = useMemo<ThemeSettings>(
    () => ({
      ...settings,
      configPresets,
      setMode: (mode) => setSettings((s) => ({ ...s, mode })),
      setPresetId: (presetId) => setSettings((s) => ({ ...s, presetId })),
    }),
    [settings, configPresets],
  );

  return (
    <ThemeSettingsContext.Provider value={api}>
      <Theme theme={theme} mode={settings.mode}>
        <LinkProvider component={Link}>{children}</LinkProvider>
      </Theme>
      {customCss ? <style data-glimpse-custom>{customCss}</style> : null}
    </ThemeSettingsContext.Provider>
  );
}
