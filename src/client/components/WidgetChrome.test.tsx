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
    const { container } = render(
      <WidgetChrome title="Secret" hideHeader>
        <div>x</div>
      </WidgetChrome>,
    );
    expect(container.querySelector('.header')).toBeNull();
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
    const dot = screen.getByTestId('widget-error-dot');
    // the kit's own StatusDot, not a hand-rolled span
    expect(dot.className).toContain('astryx-statusdot');
    expect(dot).toHaveAttribute('data-variant', 'error');
    expect(dot).toHaveAttribute('role', 'img');
    expect(dot).toHaveAttribute('aria-label', 'Broken failed to load');
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
    const btn = screen.getByRole('button', { name: /show less/i });
    expect(getComputedStyle(btn).position).not.toBe('sticky');
    const css = readFileSync('src/client/components/widget-chrome.module.css', 'utf8');
    const moreExpandedBlock = css.match(/\.moreExpanded\s*\{[^}]*\}/s)?.[0] ?? '';
    expect(moreExpandedBlock).not.toMatch(/position\s*:\s*sticky/);
    expect(moreExpandedBlock).not.toMatch(/bottom\s*:/);
  });

  it('Show more and Show less have same position (both not sticky)', () => {
    render(<WidgetChrome title="Feed" collapseAfter={2} items={rows} />);
    const moreBtn = screen.getByRole('button', { name: /show more/i });
    expect(getComputedStyle(moreBtn).position).not.toBe('sticky');
    fireEvent.click(moreBtn);
    const lessBtn = screen.getByRole('button', { name: /show less/i });
    expect(getComputedStyle(lessBtn).position).not.toBe('sticky');
    // both scroll off — identical non-sticky positioning
    expect(getComputedStyle(lessBtn).position).toBe(getComputedStyle(moreBtn).position);
  });

  it('renders list-shaped skeleton rows', () => {
    render(<WidgetChrome title="Feed" isLoading skeletonShape="list" />);
    expect(screen.getByTestId('widget-loading').className).toContain('shapeList');
  });
  it('renders stat-shaped skeleton', () => {
    render(<WidgetChrome title="Clock" isLoading skeletonShape="stat" />);
    expect(screen.getByTestId('widget-loading').className).toContain('shapeStat');
  });
});

describe('WidgetChrome brand principles', () => {
  it('renders the title as a level-3 heading, not a bare span', () => {
    render(<WidgetChrome title="My Widget">x</WidgetChrome>);
    // Two-tier hierarchy: widget headers are heading level 3.
    expect(screen.getByRole('heading', { level: 3, name: 'My Widget' })).toBeInTheDocument();
  });

  it('marks only a linked title as tappable (accent)', () => {
    const { container, rerender } = render(<WidgetChrome title="Plain">x</WidgetChrome>);
    expect(container.querySelector('h3')?.className).not.toContain('titleLink');

    rerender(
      <WidgetChrome title="Linked" titleUrl="https://example.com">
        x
      </WidgetChrome>,
    );
    expect(container.querySelector('h3')?.className).toContain('titleLink');
  });

  it('wears the error header wash only while the failure is surfaced', () => {
    const { container, rerender } = render(
      <WidgetChrome title="Broken" error="boom" showErrors={false}>
        <div>stale</div>
      </WidgetChrome>,
    );
    expect(container.querySelector('[class*="errorHeader"]')).toBeNull();

    rerender(
      <WidgetChrome title="Broken" error="boom">
        <div>stale</div>
      </WidgetChrome>,
    );
    expect(container.querySelector('[class*="errorHeader"]')).not.toBeNull();
  });

  it('carries no shadow-based depth — borders only', () => {
    const css = readFileSync('src/client/components/widget-chrome.module.css', 'utf8');
    for (const value of css.matchAll(/box-shadow\s*:\s*([^;]+);/g)) {
      expect(value[1].trim().startsWith('none')).toBe(true);
    }
  });
});

describe('WidgetChrome quiet errors (show-errors)', () => {
  it('shows the Banner by default — a self-hosted dashboard must not fail silently', () => {
    render(
      <WidgetChrome title="Broken" error="upstream exploded">
        <div>stale</div>
      </WidgetChrome>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('upstream exploded');
  });

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
