import { readFileSync } from 'node:fs';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PagePayload } from '../../shared/api';
import type { Page, WidgetType } from '../../shared/config';
import App from '../../App';
import { GlimpseThemeProvider } from '../theme/GlimpseThemeProvider';
import { PageSkeleton, PageView } from './PageView';
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

beforeEach(async () => {
  try {
    const mod = await import('../hooks/usePageData');
    (mod as any).__clearCacheForTests?.();
  } catch {}
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
  vi.useRealTimers();
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
    vi.useFakeTimers();
    const { promise: fetchPromise, resolve: resolveFetch } = Promise.withResolvers<Response>();
    vi.stubGlobal('fetch', vi.fn(() => fetchPromise));
    const page: Page & { slug: string } = {
      slug: 'home',
      name: 'Home',
      tiling: 'auto',
      columns: [
        {
          size: 'full',
          span: 2,
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
    // Before delay: no skeleton (flash suppression)
    expect(screen.queryByTestId('page-skeleton')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(260);
    });
    // Loading: the config structure renders one skeleton card per widget.
    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
    expect(screen.getAllByTestId('widget-loading')).toHaveLength(2);
    // The skeleton mirrors the ready auto-tiling layout: same grid class,
    // min-column-width var (default 300), and per-column span hint.
    const skeletonGrid = screen
      .getByTestId('page-skeleton')
      .querySelector('[class*="columns"]') as HTMLElement;
    expect(skeletonGrid.className).toContain('autoTiling');
    expect(skeletonGrid.style.getPropertyValue('--min-column-width')).toBe('300px');
    expect(
      Array.from(skeletonGrid.querySelectorAll('[data-span]')).map((t) =>
        t.getAttribute('data-span'),
      ),
    ).toEqual(['2']);
    // Switch to real timers for async fill (afterEach is safety net on failure)
    vi.useRealTimers();
    await act(async () => {
      resolveFetch(
        new Response(JSON.stringify(payload()), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    });
    const widget = await screen.findByTestId('clock-widget');
    expect(within(widget).getByText('Clock')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('widget-loading')).toBeNull());
  });

  it('renders a placeholder for unimplemented widgets', async () => {
    renderPage(
      payload({
        columns: [
          {
            size: 'full',
            widgets: [{ type: 'unknown-widget' as unknown as WidgetType, config: { type: 'unknown-widget' }, data: null }],
          },
        ],
      }),
    );
    expect(
      await screen.findByText(/unknown-widget.*not implemented/i),
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

  it('keeps column sizes on the flex layout (no inline grid template)', async () => {
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
    // columns mode: flex row; sizing lives in .smallColumn/.fullColumn
    expect(grid?.className).not.toContain('autoTiling');
    expect(grid?.style.gridTemplateColumns).toBe('');
  });

  it('keeps the flex columns layout without auto tiling by default', async () => {
    renderPage(payload());
    await screen.findByTestId('clock-widget');
    const grid = document.querySelector('[class*="columns"]') as HTMLElement;
    expect(grid.className).not.toContain('autoTiling');
    // columns-mode: flex layout, sizing via .fullColumn/.smallColumn
    expect(grid.style.gridTemplateColumns).toBe('');
  });

  it('renders the auto tiling class, min-column-width var, and per-column data-span in auto mode', async () => {
    renderPage(
      payload({
        tiling: 'auto',
        minColumnWidth: 340,
        columns: [
          { size: 'small', span: 2, widgets: [{ type: 'clock', config: { type: 'clock' }, data: null }] },
          { size: 'small', widgets: [{ type: 'clock', config: { type: 'clock' }, data: null }] },
          { size: 'full', widgets: [{ type: 'clock', config: { type: 'clock' }, data: null }] },
        ],
      }),
    );
    await screen.findAllByTestId('clock-widget');
    const grid = document.querySelector('[class*="columns"]') as HTMLElement;
    expect(grid.className).toContain('autoTiling');
    expect(grid.style.getPropertyValue('--min-column-width')).toBe('340px');
    // small/full sizes are ignored in auto mode — the pinned inline
    // gridTemplateColumns is not applied (the CSS class drives the grid).
    expect(grid.style.gridTemplateColumns).toBe('');
    const tiles = Array.from(grid.querySelectorAll('[data-span]'));
    // span 1 is the default track — only spans above 1 emit the hint
    expect(tiles.map((t) => t.getAttribute('data-span'))).toEqual(['2']);
  });

  it('sets the min-column-width var from the payload in auto mode', async () => {
    renderPage(
      payload({
        tiling: 'auto',
        minColumnWidth: 300,
        columns: [
          { size: 'small', widgets: [{ type: 'clock', config: { type: 'clock' }, data: null }] },
        ],
      }),
    );
    await screen.findByTestId('clock-widget');
    const grid = document.querySelector('[class*="columns"]') as HTMLElement;
    expect(grid.style.getPropertyValue('--min-column-width')).toBe('300px');
  });

  it('keeps the mobile collapse toggles in auto mode (columns stay DOM children)', async () => {
    renderPage(
      payload({
        tiling: 'auto',
        columns: [
          { size: 'small', widgets: [{ type: 'clock', config: { type: 'clock' }, data: null }] },
          { size: 'small', widgets: [{ type: 'clock', config: { type: 'clock' }, data: null }] },
        ],
      }),
    );
    await screen.findAllByTestId('clock-widget');
    expect(document.querySelectorAll('[class*="mobileToggle"]')).toHaveLength(2);
  });

  it('renders the collage tiling class with place() tracks and row unit', async () => {
    renderPage(
      payload({
        tiling: 'collage',
        minColumnWidth: 360,
        columns: [
          { size: 'small', span: 2, widgets: [{ type: 'clock', config: { type: 'clock' }, data: null }] },
          { size: 'small', widgets: [{ type: 'clock', config: { type: 'clock' }, data: null }] },
        ],
      }),
    );
    await screen.findAllByTestId('clock-widget');
    const grid = document.querySelector('[class*="columns"]') as HTMLElement;
    expect(grid.className).toContain('collageTiling');
    // tracks + row unit come from place(), not the measure pass: 12 desktop
    // tracks at jsdom width, 96px rows; min-column-width is auto-mode only
    expect(grid.style.gridTemplateColumns).toBe('repeat(12, minmax(0, 1fr))');
    expect(grid.style.getPropertyValue('--tile-row')).toBe('96px');
    expect(grid.style.getPropertyValue('--min-column-width')).toBe('');
    // span hints still emit their column footprint in collage mode
    const tiles = Array.from(grid.querySelectorAll('[data-span]'));
    expect(tiles.map((t) => t.getAttribute('data-span'))).toEqual(['2']);
  });

  it('emits placed row spans on collage skeleton tiles', () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const page: Page & { slug: string } = {
      slug: 'home',
      name: 'Home',
      tiling: 'collage',
      'min-column-width': 360,
      columns: [
        // tall feed (limit > 5) + markets PREF rows: 3 + 1 = 4
        {
          size: 'full',
          widgets: [
            { type: 'rss', title: 'Feeds', feeds: [{ url: 'https://example.com/feed.xml' }], limit: 10 },
            { type: 'markets', title: 'Markets', markets: [{ symbol: 'SPY' }] },
          ],
        },
        // clock PREF rows: 2
        { size: 'small', widgets: [{ type: 'clock', title: 'Clock', timezones: [] }] },
        // group container PREF rows: 3
        {
          size: 'small',
          widgets: [{ type: 'group', title: 'Group', widgets: [{ type: 'clock', title: 'Child' }] }],
        },
      ],
    };
    render(
      <MemoryRouter>
        <PageView slug="home" page={page} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('page-skeleton')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(260);
    });
    const skeleton = screen.getByTestId('page-skeleton');
    const grid = skeleton.querySelector('[class*="columns"]') as HTMLElement;
    expect(grid.className).toContain('collageTiling');
    // skeleton geometry is place() output: 12 desktop tracks, 96px rows
    expect(grid.style.gridTemplateColumns).toBe('repeat(12, minmax(0, 1fr))');
    expect(grid.style.getPropertyValue('--tile-row')).toBe('96px');
    const spans = Array.from(grid.querySelectorAll('[data-row-span]')).map(
      (t) => t.getAttribute('data-row-span'),
    );
    // feed(3)+markets(1)=4; clock PREF rows=2; group PREF rows=3
    expect(spans).toEqual(['4', '2', '3']);
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

  it('redirects an unknown slug to the home page', async () => {
    renderApp('/nonsense');
    await screen.findByTestId('clock-widget');
    // After the redirect the active page is home, whose config hides the
    // desktop navigation — the wrapper class proves the fallback config was
    // not used and no error banner for a 404'd page payload was rendered.
    const wrapper = document.querySelector('[data-testid="top-nav-wrapper"]') as HTMLElement;
    expect(wrapper.className).toContain('hideDesktopNav');
    expect(screen.queryByText('page not found')).toBeNull();
  });

  it('social collage page has bottom padding and align-content start', () => {
    const css = readFileSync('src/client/pages/page.module.css', 'utf8');
    expect(css).toMatch(/\.page\s*\{[^}]*padding-block:\s*var\(--space-gap\)/);
    expect(css).toMatch(/\.collageTiling\s*\{[^}]*align-content:\s*start/);
    expect(css).toMatch(/\.splitColumn\s*\{[^}]*gap:\s*var\(--(widget-gap|space-gap)\)/);
  });

  it('page content has uniform bottom gap regardless of tiling', () => {
    const css = readFileSync('src/client/pages/page.module.css', 'utf8');
    // .page must keep both padding-block and explicit padding-bottom (calc allowed) so collage stretch can't collapse the footer gap
    expect(css).toMatch(/\.page\s*\{[^}]*padding-bottom:\s*(var\(--(space-gap|widget-gap)\)|calc\(var\(--(space-gap|widget-gap)\))/);
    expect(css).toMatch(/\.autoTiling\s*\{[^}]*align-content:\s*start/);
  });
  it('skeleton mirrors columns (no CLS)', () => {
    const page = {
      slug: 'home',
      name: 'Home',
      columns: [
        { size: 'full' as const, widgets: [{ type: 'clock' as const, title: 'A' }] },
        { size: 'full' as const, widgets: [{ type: 'clock' as const, title: 'B' }] },
      ],
      tiling: 'columns' as const,
      'min-column-width': 320,
    } as unknown as Page & { slug: string };
    const { container } = render(
      <MemoryRouter>
        <PageSkeleton page={page} />
      </MemoryRouter>,
    );
    expect(container.querySelectorAll('[data-testid="column"]')).toHaveLength(2);
  });

  it('collage tiles carry their placed row spans from the single table', async () => {
    renderPage(
      payload({
        tiling: 'collage',
        minColumnWidth: 300,
        columns: [
          { size: 'full', widgets: [{ type: 'clock', config: { type: 'clock' }, data: null }] },
          { size: 'full', widgets: [{ type: 'videos', config: { type: 'videos' }, data: null }] },
          { size: 'full', widgets: [{ type: 'monitor', config: { type: 'monitor' }, data: null }] },
        ],
      }),
    );
    await screen.findByTestId('clock-widget');
    const grid = document.querySelector('[class*="collageTiling"]') as HTMLElement;
    // clock/videos/monitor PREF rows are all 2: every tile spans 2 rows
    const spans = Array.from(grid.querySelectorAll('[data-row-span]')).map((t) =>
      t.getAttribute('data-row-span'),
    );
    expect(spans).toEqual(['2', '2', '2']);
  });

  it('global spacing vars exist', () => {
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toContain('--space-gap');
    expect(css).toContain('--space-viewport');
    expect(css).toContain('--widget-content-vertical');
    expect(css).toContain('--widget-content-horizontal');
    // single tiling row unit shared by place(), collage, and bento
    expect(css).toContain('--tile-row');
    // DIMS also exposes them via theme tokens (read glimpseTheme file)
    const themeSrc = readFileSync('src/shared/theme/glimpseTheme.ts', 'utf8');
    expect(themeSrc).toContain("'--space-gap'");
    expect(themeSrc).toContain("'--space-viewport'");
    expect(themeSrc).toContain("'--widget-content-vertical'");
    expect(themeSrc).toContain("'--widget-content-horizontal'");
    // page and widget-chrome consume new vars (not hardcoded px)
    const pageCss = readFileSync('src/client/pages/page.module.css', 'utf8');
    expect(pageCss).toContain('var(--space-gap)');
    expect(pageCss).toContain('var(--space-viewport)');
    const chromeCss = readFileSync('src/client/components/widget-chrome.module.css', 'utf8');
    expect(chromeCss).toContain('var(--widget-content-vertical)');
    expect(chromeCss).toContain('var(--widget-content-horizontal)');
  });

  it('flat widgets render the bento grid with compositor placements', async () => {
    renderPage(
      payload({
        columns: [],
        widgets: [
          { type: 'clock', config: { type: 'clock', title: 'Clock', priority: 9, zone: 'sidebar' }, data: null },
          { type: 'clock', config: { type: 'clock', title: 'Second', span: 2 }, data: null },
        ],
        gridColumns: 12,
        gridRowHeight: 96,
      }),
    );
    const grid = await screen.findByTestId('bento-grid');
    expect(grid.className).toContain('bentoGrid');
    expect(grid.style.getPropertyValue('--bento-cols')).toBe('12');
    expect(grid.style.getPropertyValue('--bento-row')).toBe('96px');
    expect(within(grid).getAllByTestId('clock-widget')).toHaveLength(2);
    // every tile got a placement from place()
    expect(grid.querySelectorAll('[data-bento-x]').length).toBeGreaterThanOrEqual(2);
  });

  it('legacy columns pages still render MobileColumn (no bento grid)', async () => {
    // renders alongside the bento page above — scope to the newest column
    // wrapper (RTL auto-cleanup unmounts previous trees only via its own
    // afterEach, and this file relies on manual scoping elsewhere too).
    const { container } = renderPage(payload());
    await waitFor(() => {
      expect(within(container).getAllByTestId('clock-widget').length).toBeGreaterThan(0);
    });
    expect(within(container).queryByTestId('bento-grid')).toBeNull();
    expect(within(container).getByTestId('column')).toBeInTheDocument();
  });

  it('flat page skeleton mirrors the bento grid at 12 columns', () => {
    const page = {
      slug: 'home',
      name: 'Home',
      widgets: [{ type: 'clock', title: 'A' }, { type: 'rss', title: 'B' }],
    } as unknown as Page & { slug: string };
    render(
      <MemoryRouter>
        <PageSkeleton page={page} />
      </MemoryRouter>,
    );
    const sk = screen.getByTestId('bento-skeleton');
    expect(sk.style.getPropertyValue('--bento-cols')).toBe('12');
    expect(sk.querySelectorAll('[class*="bentoItem"]')).toHaveLength(2);
  });

  it('bento css: 12-col dense grid collapsing to one track on mobile', () => {
    const css = readFileSync('src/client/pages/page.module.css', 'utf8');
    expect(css).toMatch(/\.bentoGrid\s*\{[^}]*repeat\(var\(--bento-cols,\s*12\)/);
    expect(css).toMatch(/\.bentoGrid\s*\{[^}]*grid-auto-flow:\s*dense/);
    // mobile collapse lives in the ≤768px media query (!important beats the
    // earlier-in-file base rule and the inline --bento-* placement vars)
    expect(css).toMatch(/\.bentoGrid\s*\{[^}]*grid-template-columns:\s*1fr\s*!important/);
    expect(css).toMatch(/\.bentoItem\s*\{[^}]*grid-column:\s*1\s*\/\s*-1\s*!important/);
    expect(css).toMatch(/\.bentoItem\s*\{[^}]*grid-row:\s*auto\s*!important/);
  });

  it('columns css: 12-col grid, --col-span sizing, mobile collapse to full width', () => {
    const css = readFileSync('src/client/pages/page.module.css', 'utf8');
    expect(css).toMatch(
      /\.columns\s*\{[^}]*display:\s*grid[^}]*repeat\(12,\s*minmax\(0,\s*1fr\)\)[^}]*gap:\s*(var\(--widget-gap\)|clamp\([^)]*\))[^}]*align-content:\s*start/,
    );
    expect(css).toMatch(/\.column\s*\{[^}]*grid-column:\s*span var\(--col-span,\s*12\)/);
    // tablet: 6 tracks, spans above 6 collapse to 6
    expect(css).toMatch(/@media \(max-width: 900px\)/);
    expect(css).toMatch(/repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toMatch(/--col-span:\s*6 !important/);
    const media = css.slice(css.indexOf('@media (max-width: 600px)'));
    expect(media).toMatch(/\.columns \.column\s*\{[^}]*grid-column:\s*1 \/ -1/);
  });

  it('Social 4/8 columns map to spans (--col-span)', async () => {
    renderPage(
      payload({
        slug: 'social',
        name: 'Social',
        tiling: 'columns',
        columns: [
          { size: 'full', span: 4, widgets: [{ type: 'clock', config: { type: 'clock', title: 'Left' }, data: null }] },
          { size: 'full', span: 8, widgets: [{ type: 'clock', config: { type: 'clock', title: 'Right' }, data: null }] },
        ],
      }),
    );
    // wait past the loading-fallback column: only the fetched payload's
    // two grid columns carry --col-span
    await waitFor(() => expect(screen.getAllByTestId('column')).toHaveLength(2));
    const cols = screen.getAllByTestId('column');
    expect(cols[0].style.getPropertyValue('--col-span')).toBe('4');
    expect(cols[1].style.getPropertyValue('--col-span')).toBe('8');
  });

  it('does not render skeleton before 250ms', () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const page: Page & { slug: string } = {
      slug: 'home',
      name: 'Home',
      tiling: 'auto',
      columns: [{ size: 'full', widgets: [{ type: 'clock', title: 'Clock' }] }],
    } as unknown as Page & { slug: string };
    render(
      <MemoryRouter>
        <PageView slug="home" page={page} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('page-skeleton')).toBeNull();
    act(() => {
      vi.advanceTimersByTime(260);
    });
    expect(screen.getByTestId('page-skeleton')).toBeInTheDocument();
  });

  it('size-derived spans map via resolveSpan (full+small → 9/3)', async () => {
    renderPage(
      payload({
        tiling: 'columns',
        columns: [
          { size: 'full', widgets: [{ type: 'clock', config: { type: 'clock', title: 'Wide' }, data: null }] },
          { size: 'small', widgets: [{ type: 'clock', config: { type: 'clock', title: 'Narrow' }, data: null }] },
        ],
      }),
    );
    await waitFor(() => expect(screen.getAllByTestId('column')).toHaveLength(2));
    const cols = screen.getAllByTestId('column');
    expect(cols[0].style.getPropertyValue('--col-span')).toBe('9');
    expect(cols[1].style.getPropertyValue('--col-span')).toBe('3');
  });
});
