import {
  createContext,
  useContext,
  useEffect,
  useMemo,
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

  const theme = useMemo(() => buildGlimpseTheme(pair), [pair]);

  // The Astryx <Theme> emits its tokens on a wrapper INSIDE #root, so the
  // html/body level (page background, :root consumers) would keep resolving
  // the index.css fallbacks. Mirror the themed color vars onto
  // documentElement so the page background follows the active theme/mode.
  useEffect(() => {
    const root = document.documentElement;
    const decls = glanceColorVars(pair);
    const applied: string[] = [];
    for (const [name, [light, dark]] of Object.entries(decls)) {
      root.style.setProperty(name, `light-dark(${light}, ${dark})`);
      applied.push(name);
    }
    return () => {
      for (const name of applied) root.style.removeProperty(name);
    };
  }, [pair]);

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
