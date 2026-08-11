import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetById, type Preset } from '../../shared/theme/presets';
import { useThemeSettings, type ThemeSettings } from '../theme/GlimpseThemeProvider';
import { ThemePicker } from './ThemePicker';
import styles from './theme-picker.module.css';

vi.mock('../theme/GlimpseThemeProvider', () => ({
  useThemeSettings: vi.fn(),
}));

const STORAGE_KEY = 'glimpse.theme.v1';
const mockedUseThemeSettings = vi.mocked(useThemeSettings);

const mocha = presetById('catppuccin-mocha');
const gruvbox = presetById('gruvbox-dark-hard');
const github = presetById('github'); // light variant

/** jsdom normalizes inline `color: #rrggbb` to `rgb(r, g, b)`. */
function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/**
 * Context mock mirroring GlimpseThemeProvider's persistence contract:
 * setPresetId writes { mode, presetId } to `glimpse.theme.v1`.
 */
function makeSettings(presetId = mocha.id, configPresets: Preset[] = []): ThemeSettings {
  const state = { mode: 'system' as const, presetId };
  return {
    mode: state.mode,
    presetId,
    configPresets,
    setMode: vi.fn((mode) => {
      state.mode = mode;
    }),
    setPresetId: vi.fn((id: string) => {
      state.presetId = id;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: state.mode, presetId: id }));
    }),
  };
}

function presetButton(name: string): HTMLButtonElement {
  return screen.getByText(name).closest('button') as HTMLButtonElement;
}

function groupLabels(): string[] {
  const panel = screen.getByTestId('theme-panel');
  return Array.from(panel.querySelectorAll(`.${styles.groupLabel}`)).map((el) => el.textContent ?? '');
}

beforeEach(() => {
  localStorage.clear();
  mockedUseThemeSettings.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ThemePicker swatch grid', () => {
  it('renders Dark and Light groups as glance swatch grids', () => {
    mockedUseThemeSettings.mockReturnValue(makeSettings());
    const { container } = render(<ThemePicker />);

    expect(groupLabels()).toContain('Dark');
    expect(groupLabels()).toContain('Light');
    expect(groupLabels()).not.toContain('Custom'); // no config presets

    const grids = container.querySelectorAll(`.${styles.choices}`);
    expect(grids.length).toBeGreaterThanOrEqual(2);
    grids.forEach((grid) => expect(grid).toHaveClass(styles.choices));

    // every preset is a swatch-row button: name + 2 accent squares
    expect(presetButton(mocha.name)).toHaveClass(styles.preset);
    expect(presetButton(gruvbox.name)).toHaveClass(styles.preset);
  });

  it('marks the active preset with the current-state ring', () => {
    mockedUseThemeSettings.mockReturnValue(makeSettings());
    render(<ThemePicker />);

    expect(presetButton(mocha.name)).toHaveClass(styles.current);
    expect(presetButton(mocha.name).getAttribute('data-selected')).toBe('true');
    expect(presetButton(gruvbox.name)).not.toHaveClass(styles.current);
    expect(presetButton(gruvbox.name).getAttribute('data-selected')).toBe('false');
  });

  it('renders the preset palette in the swatches (base00 bg, base0D + base08 accents)', () => {
    mockedUseThemeSettings.mockReturnValue(makeSettings());
    render(<ThemePicker />);

    const button = presetButton(mocha.name);
    expect(button.getAttribute('style')).toContain(mocha.dark.base00);
    expect(button.querySelector(`.${styles.name}`)?.getAttribute('style')).toContain(rgb(mocha.dark.base05));

    const swatches = button.querySelectorAll(`.${styles.swatch}`);
    expect(swatches).toHaveLength(2);
    expect(swatches[0].getAttribute('style')).toContain(mocha.dark.base0D);
    expect(swatches[1].getAttribute('style')).toContain(mocha.dark.base08);
  });

  it('renders config presets in a Custom group with the same swatch rows', () => {
    const custom: Preset = { ...mocha, id: 'brand-sunset', name: 'Brand Sunset' };
    mockedUseThemeSettings.mockReturnValue(makeSettings('brand-sunset', [custom]));
    render(<ThemePicker />);

    expect(groupLabels()).toContain('Custom');
    expect(presetButton('Brand Sunset')).toHaveClass(styles.current);
    expect(presetButton('Brand Sunset').getAttribute('style')).toContain(mocha.dark.base00);
  });
});

describe('ThemePicker interaction', () => {
  it('selecting a preset calls setPresetId and persists to localStorage', () => {
    const settings = makeSettings();
    mockedUseThemeSettings.mockReturnValue(settings);
    render(<ThemePicker />);

    fireEvent.click(screen.getByText(gruvbox.name));

    expect(settings.setPresetId).toHaveBeenCalledWith(gruvbox.id);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as {
      mode?: string;
      presetId?: string;
    };
    expect(stored).toEqual({ mode: 'system', presetId: gruvbox.id });
  });

  it('mode toggle calls setMode', () => {
    const settings = makeSettings();
    mockedUseThemeSettings.mockReturnValue(settings);
    render(<ThemePicker />);

    // the panel lives inside the popover frame — open it first
    fireEvent.click(screen.getByRole('button', { name: 'Theme' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(settings.setMode).toHaveBeenCalledWith('dark');
  });
});

describe('ThemePicker trigger preview', () => {
  it('shows the active theme colors and lights up when the popover opens', () => {
    mockedUseThemeSettings.mockReturnValue(makeSettings());
    render(<ThemePicker />);

    const trigger = screen.getByRole('button', { name: 'Theme' });
    expect(trigger).toHaveClass(styles.trigger);
    expect(trigger.getAttribute('style')).toContain(mocha.dark.base00);
    expect(trigger.querySelectorAll(`.${styles.swatch}`)).toHaveLength(2);
    expect(trigger).not.toHaveClass(styles.popoverActive);

    fireEvent.click(trigger);
    expect(trigger).toHaveClass(styles.popoverActive);
  });

  it('uses the compact light-preset sizing when the active theme is light', () => {
    mockedUseThemeSettings.mockReturnValue(makeSettings(github.id));
    render(<ThemePicker />);

    const trigger = screen.getByRole('button', { name: 'Theme' });
    expect(trigger).toHaveClass(styles.triggerLight);
    expect(trigger.getAttribute('style')).toContain(github.dark.base00);
  });
});
