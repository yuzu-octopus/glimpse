import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PagePayload } from '../../shared/api';
import type { Page, WidgetType } from '../../shared/config';
import App from '../../App';
import { GlimpseThemeProvider } from '../theme/GlimpseThemeProvider';
import { PageView } from './PageView';
import { clientWidgets, registerWidgetComponent } from '../widgets/registry';

function payload(overrides: Partial<PagePayload> = {}): PagePayload {
  return {
    slug: 'home',
    name: 'Home',
    width: 'default',
    headWidgets: [],
    columns: [
      {
        size: 'full',
        widgets: [
          {
            type: 'clock',
            config: { type: 'clock', title: 'Clock', timezones: [] },
            data: null,
          },
        ],
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  registerWidgetComponent('clock' as WidgetType, ({ config, error }) => (
    <div data-testid="clock-widget">
      {error ? <span data-testid="widget-error">{error}</span> : String(config.title)}
    </div>
  ));
  // jsdom lacks matchMedia; Astryx components (Spinner, Theme) use it
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
});

afterEach(() => {
  clientWidgets.delete('clock' as WidgetType);
  vi.unstubAllGlobals();
});

function renderPage(p: PagePayload) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify(p), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  return render(
    <MemoryRouter>
      <PageView slug={p.slug} />
    </MemoryRouter>,
  );
}

// Shared by the App-level tests: one config, two pages, so the module-level
// useConfig cache stays consistent across both renders.
const APP_CONFIG_PAGES = [
  {
    name: 'Home',
    slug: 'home',
    width: 'default',
    'hide-desktop-navigation': true,
    'desktop-navigation-width': 'slim',
    columns: [{ size: 'full', widgets: [{ type: 'clock', config: { type: 'clock' }, data: null }] }],
  },
  {
    name: 'Docs',
    slug: 'docs',
    width: 'default',
    columns: [{ size: 'full', widgets: [{ type: 'clock', config: { type: 'clock' }, data: null }] }],
  },
];

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function renderApp(initialEntry: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/config') return json({ config: { pages: APP_CONFIG_PAGES } });
      if (url === '/api/theme') return json({ customCss: null });
      return json(payload());
    }),
  );
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <GlimpseThemeProvider>
        <App />
      </GlimpseThemeProvider>
    </MemoryRouter>,
  );
}

describe('PageView', () => {
  it('renders widget components from the registry', async () => {
    renderPage(payload());
    const widget = await screen.findByTestId('clock-widget');
    expect(within(widget).getByText('Clock')).toBeInTheDocument();
  });

  it('renders per-widget skeleton cards from the page config while loading, then fills', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify(payload()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const page: Page & { slug: string } = {
      slug: 'home',
      name: 'Home',
      columns: [
        {
          size: 'full',
          widgets: [
            { type: 'clock', title: 'Clock', timezones: [] },
            { type: 'clock', title: 'Second Clock', timezones: [] },
          ],
        },
      ],
    };
    render(
      <MemoryRouter>
        <PageView slug="home" page={page} />
      </MemoryRouter>,
    );
    // Loading: the config structure renders one skeleton card per widget.
    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
    expect(screen.getAllByTestId('widget-loading')).toHaveLength(2);
    // ...then the fetched data fills the widgets in.
    const widget = await screen.findByTestId('clock-widget');
    expect(within(widget).getByText('Clock')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByTestId('widget-loading')).toBeNull(),
    );
  });

  it('renders a placeholder for unimplemented widgets', async () => {
    renderPage(
      payload({
        columns: [
          {
            size: 'full',
            widgets: [{ type: 'reddit', config: { type: 'reddit' }, data: null }],
          },
        ],
      }),
    );
    expect(
      await screen.findByText(/reddit.*not implemented/i),
    ).toBeInTheDocument();
  });

  it('passes the widget error through to the component', async () => {
    renderPage(
      payload({
        columns: [
          {
            size: 'full',
            widgets: [
              { type: 'clock', config: { type: 'clock' }, data: null, error: 'boom' },
            ],
          },
        ],
      }),
    );
    const err = await screen.findByTestId('widget-error');
    expect(err).toHaveTextContent('boom');
  });

  it('renders group children as tabs', async () => {
    renderPage(
      payload({
        columns: [
          {
            size: 'full',
            widgets: [
              {
                type: 'group',
                config: { type: 'group' },
                data: null,
                widgets: [
                  { type: 'clock', config: { type: 'clock', title: 'Tab A' }, data: null },
                  { type: 'clock', config: { type: 'clock', title: 'Tab B' }, data: null },
                ],
              },
            ],
          },
        ],
      }),
    );
    expect((await screen.findAllByText('Tab A')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tab B').length).toBeGreaterThan(0);
    // first tab active by default
    expect(screen.getByTestId('clock-widget')).toBeInTheDocument();
  });

  it('shows a page-level error when the fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"error":"bad slug"}', { status: 404 })),
    );
    render(
      <MemoryRouter>
        <PageView slug="nope" />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText('bad slug')).toBeInTheDocument());
  });

  it('sets grid columns from column sizes', async () => {
    renderPage(
      payload({
        columns: [
          { size: 'small', widgets: [{ type: 'clock', config: { type: 'clock' }, data: null }] },
          { size: 'full', widgets: [{ type: 'clock', config: { type: 'clock' }, data: null }] },
        ],
      }),
    );
    const widgets = await screen.findAllByTestId('clock-widget');
    expect(widgets).toHaveLength(2);
    const grid = document.querySelector('[class*="columns"]') as HTMLElement;
    expect(grid?.style.gridTemplateColumns).toBe('300px minmax(0, 1fr)');
  });

  it('renders a mobile page-name header when show-mobile-header is set', async () => {
    renderPage(payload({ name: 'My Page', 'show-mobile-header': true }));
    const header = await screen.findByText('My Page');
    expect(header.className).toContain('mobileHeader');
  });

  it('does not render the mobile header by default', async () => {
    renderPage(payload());
    await screen.findByTestId('clock-widget');
    expect(screen.queryByText('Home')).toBeNull();
  });

  it('opens the active group tab title-url in a new tab', async () => {
    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);
    renderPage(
      payload({
        columns: [
          {
            size: 'full',
            widgets: [
              {
                type: 'group',
                config: {
                  type: 'group',
                  'title-url': 'https://example.com/group',
                },
                data: null,
                widgets: [
                  {
                    type: 'clock',
                    config: { type: 'clock', title: 'Tab A' },
                    data: null,
                  },
                  { type: 'clock', config: { type: 'clock', title: 'Tab B' }, data: null },
                ],
              },
            ],
          },
        ],
      }),
    );
    // tab A is active by default — clicking it opens the group's title-url
    fireEvent.click(await screen.findByRole('button', { name: 'Tab A' }));
    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/group',
      '_blank',
      'noopener,noreferrer',
    );

    // clicking tab B switches to it and opens nothing
    fireEvent.click(screen.getByRole('button', { name: 'Tab B' }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    // content switched to tab B (clock title 'Tab B' now rendered in body)
    expect(screen.getAllByText('Tab B').length).toBeGreaterThan(1);

    // clicking tab B again (now active) opens the group title-url
    fireEvent.click(screen.getByRole('button', { name: 'Tab B' }));
    expect(openSpy).toHaveBeenCalledTimes(2);
  });

  it('hides desktop navigation and constrains nav width from the page config', async () => {
    renderApp('/');
    await screen.findByTestId('clock-widget');
    const wrapper = document.querySelector('[data-testid="top-nav-wrapper"]') as HTMLElement;
    expect(wrapper.className).toContain('hideDesktopNav');
    const nav = wrapper.querySelector('nav[aria-label="Pages"]') as HTMLElement;
    expect(nav.style.maxWidth).toBe('1100px');
  });

  it('keeps desktop navigation visible when the page does not hide it', async () => {
    renderApp('/docs');
    await screen.findByTestId('clock-widget');
    const wrapper = document.querySelector('[data-testid="top-nav-wrapper"]') as HTMLElement;
    expect(wrapper.className).not.toContain('hideDesktopNav');
    const nav = wrapper.querySelector('nav[aria-label="Pages"]') as HTMLElement;
    expect(nav.style.maxWidth).toBe('');
  });

  it('renders the mobile navigation bar (shown below the 768px breakpoint)', async () => {
    renderApp('/');
    await screen.findByTestId('clock-widget');
    expect(document.querySelector('[data-testid="mobile-navigation"]')).toBeTruthy();
  });
});
