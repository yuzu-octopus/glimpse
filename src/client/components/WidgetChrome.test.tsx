import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WidgetChrome } from './WidgetChrome';

const rows = Array.from({ length: 5 }, (_, i) => <div key={i}>row {i}</div>);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('WidgetChrome', () => {
  it('renders the title and children', () => {
    render(
      <WidgetChrome title="My Widget">
        <div>content</div>
      </WidgetChrome>,
    );
    expect(screen.getByText('My Widget')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('hides the header when hideHeader is set', () => {
    // By role, not by a literal `.header` class: Vitest serves CSS modules as
    // a hashed proxy, so `querySelector('.header')` is null whether or not the
    // header renders and the assertion could not fail.
    const { container } = render(
      <WidgetChrome title="Secret" hideHeader>
        <div>x</div>
      </WidgetChrome>,
    );
    expect(screen.queryByRole('heading', { level: 3, name: 'Secret' })).toBeNull();
    expect(container.querySelector('h3')).toBeNull();
  });

  it('collapses lists beyond collapseAfter and expands on click', () => {
    render(<WidgetChrome title="Feed" collapseAfter={3} items={rows} />);
    expect(screen.queryByText('row 3')).toBeNull();
    expect(screen.getByText('row 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /show more/i }));
    expect(screen.getByText('row 4')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /show more/i })).toBeNull();
  });

  it('does not render a collapse button when within the limit', () => {
    render(<WidgetChrome title="Feed" collapseAfter={5} items={rows} />);
    expect(screen.queryByRole('button', { name: /show more/i })).toBeNull();
    expect(screen.getByText('row 4')).toBeInTheDocument();
  });

  it('surfaces the error through the kit error Banner (role=alert)', () => {
    render(
      <WidgetChrome title="Broken" error="upstream exploded">
        <div>content</div>
      </WidgetChrome>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('upstream exploded');
    expect(screen.queryByText('content')).toBeNull();
  });

  it('shows skeleton rows while loading', () => {
    render(
      <WidgetChrome title="Loading" isLoading>
        <div>content</div>
      </WidgetChrome>,
    );
    expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
    expect(screen.queryByText('content')).toBeNull();
  });

  it('never collapses when collapseAfter is -1', () => {
    render(<WidgetChrome title="Feed" collapseAfter={-1} items={rows} />);
    expect(screen.queryByRole('button', { name: /show more/i })).toBeNull();
    expect(screen.getByText('row 4')).toBeInTheDocument();
  });

  it('collapses back with Show less and scrolls the card into view', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    render(<WidgetChrome title="Feed" collapseAfter={3} items={rows} />);

    fireEvent.click(screen.getByRole('button', { name: /show more/i }));
    expect(screen.getByText('row 4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show less/i }));
    expect(screen.queryByText('row 3')).toBeNull();
    expect(screen.getByRole('button', { name: /show more \(2\)/i })).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('flags a failure with a StatusDot carrying an accessible name and title', () => {
    render(
      <WidgetChrome title="Broken" error="upstream exploded">
        <div>content</div>
      </WidgetChrome>,
    );
    // the kit's own StatusDot, not a hand-rolled span: it is the component's
    // role and accessible name that carry the failure, and data-variant is the
    // hook core emits for it. No class name is asserted — `astryx-statusdot`
    // survives only on core's legacyNames shim (dist/StatusDot/StatusDot.js)
    // and 0.7.0 drops it.
    const dot = screen.getByRole('img', { name: 'Broken failed to load' });
    expect(dot).toHaveAttribute('data-variant', 'error');
    // the kit's hover explanation — a closed popover, so it is hidden from
    // the a11y tree until the dot is hovered
    expect(screen.getByRole('tooltip', { hidden: true })).toHaveTextContent(
      'Broken failed to load',
    );
    // error Banner stays in the body
    expect(screen.getByText('upstream exploded')).toBeInTheDocument();
  });

  it('does not render the error dot when there is no error', () => {
    render(
      <WidgetChrome title="Fine">
        <div>content</div>
      </WidgetChrome>,
    );
    expect(screen.queryByTestId('widget-error-dot')).toBeNull();
  });

  it('Show less scrolls with content (not sticky)', () => {
    render(<WidgetChrome title="Feed" collapseAfter={2} items={rows} />);
    fireEvent.click(screen.getByRole('button', { name: /show more/i }));
    expect(screen.getByRole('button', { name: /show less/i })).toBeInTheDocument();
    // The kit Button owns the toggle's box, so nothing in the module may pin
    // it to the viewport — the guard used to be scoped to the one class the
    // raw button owned. A `getComputedStyle(btn).position` check would be
    // vacuous: jsdom injects no stylesheet under vitest, so the computed
    // value is always "static" and it would pass with `position: sticky` in
    // the CSS. The stylesheet source is the surface that can actually fail.
    const css = readFileSync('src/client/components/widget-chrome.module.css', 'utf8');
    expect(css).not.toMatch(/position\s*:\s*sticky/);
  });

  it('paints a genuinely different skeleton per shape', () => {
    // Structure, not a hashed class. `className.toContain('shapeList')` only
    // matched by accident of the hash suffix.
    const counts: Record<string, number> = {};
    for (const shape of ['list', 'stat', 'rows', 'chart'] as const) {
      const { unmount } = render(
        <WidgetChrome title="S" isLoading skeletonShape={shape} />,
      );
      counts[shape] = screen.getByTestId('widget-loading').children.length;
      unmount();
    }
    expect(counts).toEqual({ list: 5, stat: 2, rows: 3, chart: 1 });
  });
});

describe('WidgetChrome brand principles', () => {
  it('renders the title as a level-3 heading, not a bare span', () => {
    render(<WidgetChrome title="My Widget">x</WidgetChrome>);
    // Two-tier hierarchy: widget headers are heading level 3.
    expect(screen.getByRole('heading', { level: 3, name: 'My Widget' })).toBeInTheDocument();
  });

  it('renders the title as a real anchor only when titleUrl is set', () => {
    const { container, rerender } = render(<WidgetChrome title="Plain">x</WidgetChrome>);
    expect(container.querySelector('a')).toBeNull();

    rerender(
      <WidgetChrome title="Linked" titleUrl="https://example.com">
        x
      </WidgetChrome>,
    );
    expect(screen.getByRole('link', { name: 'Linked' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
  });

  it('surfaces the failure only while showErrors is on', () => {
    const { rerender } = render(
      <WidgetChrome title="Broken" error="boom" showErrors={false}>
        <div>stale</div>
      </WidgetChrome>,
    );
    expect(screen.queryByRole('alert')).toBeNull();

    rerender(
      <WidgetChrome title="Broken" error="boom">
        <div>stale</div>
      </WidgetChrome>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('boom');
  });

  it('carries no shadow-based depth — borders only', () => {
    const css = readFileSync('src/client/components/widget-chrome.module.css', 'utf8');
    for (const value of css.matchAll(/box-shadow\s*:\s*([^;]+);/g)) {
      expect(value[1].trim().startsWith('none')).toBe(true);
    }
  });
});

describe('WidgetChrome quiet errors (show-errors)', () => {

  it('hides the Banner text and keeps the chrome and stale content when false', () => {
    render(
      <WidgetChrome title="Broken" error="upstream exploded" showErrors={false}>
        <div>stale</div>
      </WidgetChrome>,
    );
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    expect(screen.getByText('stale')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText('upstream exploded')).toBeNull();
  });

  it('renders an empty card, not a hole, when quiet and there is no stale content', () => {
    render(<WidgetChrome title="Broken" error="upstream exploded" showErrors={false} />);
    expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    expect(screen.getByTestId('widget-body')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('still reports the failure with a StatusDot in both modes', () => {
    const { rerender } = render(
      <WidgetChrome title="Broken" error="upstream exploded" showErrors={false} />,
    );
    expect(screen.getByTestId('widget-error-dot')).toHaveAttribute(
      'aria-label',
      'Broken failed to load',
    );

    rerender(<WidgetChrome title="Broken" error="upstream exploded" />);
    expect(screen.getByTestId('widget-error-dot')).toHaveAttribute(
      'aria-label',
      'Broken failed to load',
    );
  });
});
