import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '@astryxdesign/core/theme';
import type { Config } from '../../shared/config';
import { hslToHex } from '../../shared/theme/base16';
import { buildConfigPresets, hslBlockToColors } from '../../shared/theme/glanceHsl';
import { BASE16_KEYS } from '../../shared/theme/presets';
import { SettingsPanel } from '../components/SettingsPanel';
import { GlimpseThemeProvider } from './GlimpseThemeProvider';

function configWithPresets(): Config {
  return {
    pages: [{ name: 'Home', columns: [{ size: 'full', widgets: [] }] }],
    theme: {
      presets: {
        'brand-sunset': {
          'background-color': '229 19 23',
          'primary-color': '222 74 74',
          'positive-color': '96 44 68',
          'negative-color': '359 68 71',
        },
        'brand-fog': {
          light: true,
          'background-color': '220 23 95',
          'primary-color': '220 91 54',
        },
      },
    },
  };
}

function stubApi(config: Config) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL) => {
      const u = String(url);
      if (u === '/api/config') {
        return new Response(JSON.stringify({ config }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (u === '/api/theme') {
        return new Response(JSON.stringify({ customCss: null }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`unexpected fetch: ${u}`);
    }),
  );
}

/** Reads the active Astryx theme name from the provider. */
function ThemeProbe() {
  const { name } = useTheme();
  return <span data-testid="theme-name">{name}</span>;
}

/** jsdom has no matchMedia; useTheme() reads it unconditionally. */
function stubMatchMedia() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

beforeEach(() => {
  localStorage.clear();
  stubMatchMedia();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hslBlockToColors', () => {
  it('produces a valid 16-color palette of hex values', () => {
    const colors = hslBlockToColors({
      'background-color': '229 19 23',
      'primary-color': '222 74 74',
    });
    for (const key of BASE16_KEYS) {
      expect(colors[key]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('falls back to glance documented defaults for omitted colors', () => {
    const colors = hslBlockToColors({});
    expect(colors.base00).toBe(hslToHex(240, 8, 9)); // background-color default
    expect(colors.base0D).toBe(hslToHex(43, 50, 55)); // primary-color default
    expect(colors.base0B).toBe(hslToHex(43, 50, 55)); // positive defaults to primary
    expect(colors.base08).toBe(hslToHex(0, 70, 60)); // negative-color default
  });

  it('supports %-suffixed HSL values', () => {
    const colors = hslBlockToColors({ 'background-color': '229 19% 23%' });
    expect(colors.base00).toBe(hslToHex(229, 19, 23));
  });
});

describe('buildConfigPresets', () => {
  it('marks variant by the light flag', () => {
    const presets = buildConfigPresets(configWithPresets().theme);
    expect(presets).toHaveLength(2);

    expect(presets[0]).toMatchObject({ id: 'brand-sunset', name: 'brand-sunset', variant: 'dark' });
    expect(presets[0].light).toBeUndefined(); // dark block: light side derived

    expect(presets[1]).toMatchObject({ id: 'brand-fog', name: 'brand-fog', variant: 'light' });
    expect(presets[1].light).toBeDefined(); // light block: colors are the light side
    expect(presets[1].dark).toBeDefined(); // dark side derived via inversion
    expect(presets[1].dark).not.toEqual(presets[1].light);
  });

  it('returns an empty list without theme.presets', () => {
    expect(buildConfigPresets(undefined)).toEqual([]);
    expect(buildConfigPresets({})).toEqual([]);
  });
});

describe('config presets in the settings panel', () => {
  it('renders config presets in a Custom group and persists a selection', async () => {
    stubApi(configWithPresets());
    render(
      <MemoryRouter>
        <GlimpseThemeProvider>
          <SettingsPanel />
          <ThemeProbe />
        </GlimpseThemeProvider>
      </MemoryRouter>,
    );

    // config arrives async — custom group appears after the fetch resolves
    await waitFor(() => expect(screen.getByText('Custom')).toBeInTheDocument());
    expect(screen.getByText('brand-sunset')).toBeInTheDocument();
    expect(screen.getByText('brand-fog')).toBeInTheDocument();

    // selecting a config preset persists its key and activates it
    fireEvent.click(screen.getByText('brand-sunset'));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('glimpse.theme.v1') ?? '{}') as {
        presetId?: string;
      };
      expect(stored.presetId).toBe('brand-sunset');
    });
    await waitFor(() => expect(screen.getByTestId('theme-name')).toHaveTextContent('brand-sunset'));
  });
});
