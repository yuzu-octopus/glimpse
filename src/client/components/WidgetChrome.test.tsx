import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WidgetChrome } from './WidgetChrome';

const rows = Array.from({ length: 5 }, (_, i) => <div key={i}>row {i}</div>);

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
});
