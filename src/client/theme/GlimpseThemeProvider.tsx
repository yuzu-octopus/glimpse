import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { Theme, defineTheme, type ThemeMode } from '@astryxdesign/core/theme';
import { LinkProvider } from '@astryxdesign/core/Link';
import { buildTheme } from '../../shared/theme/base16ToAstryx';
import { invertLuminance } from '../../shared/theme/base16';
import { presetById } from '../../shared/theme/presets';
import { customThemeTokens } from '../../shared/theme/glanceHsl';
import { useConfig } from '../hooks/useConfig';

const STORAGE_KEY = 'glimpse.theme.v1';

export interface ThemeSettings {
  mode: ThemeMode;
  presetId: string;
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

  const theme = useMemo(() => {
    const preset = presetById(settings.presetId);
    const light = preset.light ?? invertLuminance(preset.dark);
    let t = buildTheme(preset.id, light, preset.dark);
    const custom =
      configState.status === 'ready' && configState.config.theme
        ? customThemeTokens(configState.config.theme)
        : {};
    if (Object.keys(custom).length > 0) {
      t = defineTheme({ name: preset.id, extends: t, tokens: custom });
    }
    return t;
  }, [settings.presetId, configState]);

  const api = useMemo<ThemeSettings>(
    () => ({
      ...settings,
      setMode: (mode) => setSettings((s) => ({ ...s, mode })),
      setPresetId: (presetId) => setSettings((s) => ({ ...s, presetId })),
    }),
    [settings],
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
