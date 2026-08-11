import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { presetById, type Preset } from '../../shared/theme/presets';
import { useThemeSettings, type ThemeSettings } from '../theme/GlimpseThemeProvider';
import { SettingsPanel } from './SettingsPanel';
import styles from './settings-panel.module.css';

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

/**
 * jsdom does not implement the <dialog> modal methods; Astryx Dialog calls
 * showModal/close in an effect when isOpen flips. Stub them on the prototype
 * (attribute-backed, matching the real reflection).
 */
function stubDialogModal() {
  const proto = HTMLDialogElement.prototype as unknown as {
    showModal?: () => void;
    close?: () => void;
    open?: boolean;
  };
  if (proto.showModal) return;
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  Object.defineProperty(proto, 'open', {
    configurable: true,
    get(this: HTMLDialogElement) {
      return this.hasAttribute('open');
    },
    set(this: HTMLDialogElement, value: boolean) {
      if (value) this.setAttribute('open', '');
      else this.removeAttribute('open');
    },
  });
}

function presetCard(name: string): HTMLElement {
  return screen.getByText(name).closest('[data-testid="preset-card"]') as HTMLElement;
}

function groupLabels(): string[] {
  const panel = screen.getByTestId('settings-panel');
  return Array.from(panel.querySelectorAll(`.${styles.groupLabel}`)).map((el) => el.textContent ?? '');
}

beforeAll(() => {
  stubDialogModal();
});

beforeEach(() => {
  localStorage.clear();
  mockedUseThemeSettings.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SettingsPanel theme gallery', () => {
  it('renders Dark and Light groups as glance swatch grids', () => {
    mockedUseThemeSettings.mockReturnValue(makeSettings());
    const { container } = render(<SettingsPanel />);

    expect(groupLabels()).toContain('Dark');
    expect(groupLabels()).toContain('Light');
    expect(groupLabels()).not.toContain('Custom'); // no config presets

    const grids = container.querySelectorAll(`.${styles.grid}`);
    expect(grids.length).toBeGreaterThanOrEqual(2);

    // every preset is a card: name + 3 palette swatches
    expect(presetCard(mocha.name)).toHaveClass(styles.card);
    expect(presetCard(gruvbox.name)).toHaveClass(styles.card);
  });

  it('marks the active preset with the current-state ring', () => {
    mockedUseThemeSettings.mockReturnValue(makeSettings());
    render(<SettingsPanel />);

    // current preset: primary-colored inset ring; others: none
    expect(presetCard(mocha.name).getAttribute('style')).toContain('var(--color-primary)');
    expect(presetCard(mocha.name).getAttribute('data-selected')).toBe('true');
    expect(presetCard(gruvbox.name).getAttribute('style')).toBeNull();
    expect(presetCard(gruvbox.name).getAttribute('data-selected')).toBe('false');
  });

  it('renders the preset palette in the swatches (base00, base0D, base08)', () => {
    mockedUseThemeSettings.mockReturnValue(makeSettings());
    render(<SettingsPanel />);

    const card = presetCard(mocha.name);
    const swatches = card.querySelectorAll(`.${styles.swatch}`);
    expect(swatches).toHaveLength(3);
    expect(swatches[0].getAttribute('style')).toContain(rgb(mocha.dark.base00));
    expect(swatches[1].getAttribute('style')).toContain(rgb(mocha.dark.base0D));
    expect(swatches[2].getAttribute('style')).toContain(rgb(mocha.dark.base08));
    expect(card.querySelector(`.${styles.name}`)?.textContent).toBe(mocha.name);
    expect(card.querySelector(`.${styles.tag}`)?.textContent).toBe('dark');
  });

  it('shows the light palette for light-variant presets', () => {
    mockedUseThemeSettings.mockReturnValue(makeSettings(github.id));
    render(<SettingsPanel />);

    const card = presetCard(github.name);
    const swatches = card.querySelectorAll(`.${styles.swatch}`);
    expect(swatches[0].getAttribute('style')).toContain(rgb(github.light!.base00));
    expect(swatches[1].getAttribute('style')).toContain(rgb(github.light!.base0D));
    expect(swatches[2].getAttribute('style')).toContain(rgb(github.light!.base08));
    expect(card.querySelector(`.${styles.tag}`)?.textContent).toBe('light');
  });

  it('renders config presets in a Custom group with the same swatch cards', () => {
    const custom: Preset = { ...mocha, id: 'brand-sunset', name: 'Brand Sunset' };
    mockedUseThemeSettings.mockReturnValue(makeSettings('brand-sunset', [custom]));
    render(<SettingsPanel />);

    expect(groupLabels()).toContain('Custom');
    expect(presetCard('Brand Sunset').getAttribute('style')).toContain('var(--color-primary)');
    expect(presetCard('Brand Sunset').getAttribute('data-selected')).toBe('true');
  });
});

describe('SettingsPanel section sidebar', () => {
  it('renders a nav with Appearance (active) and About', () => {
    mockedUseThemeSettings.mockReturnValue(makeSettings());
    render(<SettingsPanel />);

    const nav = screen.getByTestId('settings-nav');
    const appearance = within(nav).getByText('Appearance');
    const about = within(nav).getByText('About');

    expect(appearance.closest('button')).toHaveClass(styles.navItemActive);
    expect(appearance.closest('button')?.getAttribute('aria-selected')).toBe('true');
    expect(appearance.closest('button')?.getAttribute('role')).toBe('tab');
    expect(about.closest('button')).not.toHaveClass(styles.navItemActive);
    expect(about.closest('button')?.getAttribute('aria-selected')).toBe('false');
  });

  it('switches between the Appearance gallery and the About pane', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            config: {},
            configPath: '/etc/glimpse/config.yml',
            version: '9.9.9',
          }),
      }),
    );
    mockedUseThemeSettings.mockReturnValue(makeSettings());
    render(<SettingsPanel />);

    const nav = screen.getByTestId('settings-nav');
    const about = within(nav).getByText('About');

    fireEvent.click(about);
    expect(within(nav).getByText('About').closest('button')).toHaveClass(styles.navItemActive);
    expect(screen.getByText('Glimpse — a glance-style dashboard for your homelab.')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(await screen.findByText('9.9.9')).toBeInTheDocument();
    expect(screen.getByText('Config file')).toBeInTheDocument();
    expect(await screen.findByText('/etc/glimpse/config.yml')).toBeInTheDocument();
    // gallery is unmounted while About is shown
    expect(screen.queryByText(gruvbox.name)).toBeNull();

    fireEvent.click(within(nav).getByText('Appearance'));
    expect(presetCard(gruvbox.name)).toBeInTheDocument();
    expect(screen.queryByText('/etc/glimpse/config.yml')).toBeNull();
  });
});

describe('SettingsPanel interaction', () => {
  it('selecting a preset calls setPresetId and persists to localStorage', () => {
    const settings = makeSettings();
    mockedUseThemeSettings.mockReturnValue(settings);
    render(<SettingsPanel />);

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
    render(<SettingsPanel />);

    // the mode control lives inside the dialog — open it first
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(settings.setMode).toHaveBeenCalledWith('dark');
  });
});

describe('SettingsPanel trigger and dialog', () => {
  it('the gear button opens the settings dialog and the close button closes it', () => {
    mockedUseThemeSettings.mockReturnValue(makeSettings());
    render(<SettingsPanel />);

    const trigger = screen.getByRole('button', { name: 'Settings' });
    expect(trigger.querySelector('svg')).not.toBeNull();
    expect(document.querySelector('dialog')?.open).toBe(false);

    fireEvent.click(trigger);
    expect(document.querySelector('dialog')?.open).toBe(true);
    // the pane opens on Appearance, showing the section title and the nav
    expect(screen.getAllByText('Appearance').length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(document.querySelector('dialog')?.open).toBe(false);
  });
});
