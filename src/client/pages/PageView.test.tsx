import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PagePayload } from '../../shared/api';
import type { WidgetType } from '../../shared/config';
import { PageView } from './PageView';
import { clientWidgets, registerWidgetComponent } from '../widgets/registry';

function payload(overrides: Partial<PagePayload> = {}): PagePayload {
  return {
    slug: 'home',
    name: 'Home',
    width: 'default',
    headWidgets: [],
    columns: [
      { size: 'full', widgets: [{ type: 'clock', config: { type: 'clock', title: 'Clock' }, data: null }] },
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

describe('PageView', () => {
  it('renders widget components from the registry', async () => {
    renderPage(payload());
    const widget = await screen.findByTestId('clock-widget');
    expect(within(widget).getByText('Clock')).toBeInTheDocument();
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
});
