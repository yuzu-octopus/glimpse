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

  it('shows an error banner when error is set', () => {
    render(
      <WidgetChrome title="Broken" error="upstream exploded">
        <div>content</div>
      </WidgetChrome>,
    );
    expect(screen.getByText('upstream exploded')).toBeInTheDocument();
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

  it('shows a red status dot next to the title when error is set', () => {
    render(
      <WidgetChrome title="Broken" error="upstream exploded">
        <div>content</div>
      </WidgetChrome>,
    );
    const dot = screen.getByTestId('widget-error-dot');
    expect(dot.className).toContain('errorDot');
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
});
