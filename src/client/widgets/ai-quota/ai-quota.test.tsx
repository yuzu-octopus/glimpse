import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiQuota } from './index';

describe('ai-quota widget', () => {

  const WINDOWS = [
    { label: 'primary', usedPercent: 15, windowMinutes: 300, resetsAt: Date.now() + 3600000 },
  ];

  it('renders bars per window and plan', () => {
    render(
      <AiQuota
        config={{ type: 'ai-quota', provider: 'codex' } as never}
        data={{
          provider: 'codex',
          plan: 'pro',
          windows: [{ label: 'primary', usedPercent: 15, windowMinutes: 300, resetsAt: Date.now() + 3600000 }],
        }}
        error={undefined}
        isLoading={false}
      />,
    );
    expect(screen.getByText(/pro/i)).toBeInTheDocument();
    expect(screen.getByText(/15%/)).toBeInTheDocument();
    expect(screen.getByText(/resets in/i)).toBeInTheDocument();
  });

  it('shows skeleton when isLoading', () => {
    render(<AiQuota config={{ type: 'ai-quota' } as never} data={null} error={undefined} isLoading />);
    expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
  });

  // A quota window is a magnitude against a domain, not progress toward a
  // completion, so the bar must be the kit's DataBar. Reverting to core's
  // ProgressBar fails on the first assertion: that component reports
  // role="progressbar", so the img the DataBar renders is simply absent.
  it('meters the window as a data bar, not a progress bar', () => {
    render(
      <AiQuota
        config={{ type: 'ai-quota' } as never}
        data={{ provider: 'codex', windows: WINDOWS }}
      />,
    );
    expect(screen.getByRole('img', { name: 'primary' })).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  // The escalation ladder is the signal the widget exists to show, and the
  // colour contract says a mark resolves to a --color-data-* role token. Read
  // the fill off the rendered segment so neither can be silently broken.
  it.each([
    {usedPercent: 15, color: 'var(--color-data-categorical-cyan)'},
    {usedPercent: 70, color: 'var(--color-data-yellow-2)'},
    {usedPercent: 95, color: 'var(--color-data-categorical-red)'},
  ])('paints $usedPercent% consumption in its status token', ({usedPercent, color}) => {
    render(
      <AiQuota
        config={{ type: 'ai-quota' } as never}
        data={{
          provider: 'codex',
          windows: [{ label: 'primary', usedPercent, windowMinutes: 300, resetsAt: Date.now() + 3600000 }],
        }}
      />,
    );
    const fill = screen.getByRole('img', { name: 'primary' }).firstElementChild as HTMLElement;
    expect(fill).toHaveStyle({ background: color });
  });

  // Bar length is what makes a meter scannable, so the two segments have to
  // add up to the whole window rather than each filling the track.
  it('splits the bar into consumed and remaining share of one 100% window', () => {
    render(
      <AiQuota
        config={{ type: 'ai-quota' } as never}
        data={{
          provider: 'codex',
          windows: [{ label: 'primary', usedPercent: 25, windowMinutes: 300, resetsAt: Date.now() + 3600000 }],
        }}
      />,
    );
    const segments = screen.getByRole('img', { name: 'primary' }).children;
    expect(segments).toHaveLength(2);
    expect((segments[0] as HTMLElement).style.flexBasis).toBe('25%');
    expect((segments[1] as HTMLElement).style.flexBasis).toBe('75%');
  });

  // A zero window is the all-zero case DataBar has an explicit track fill for.
  // Reverting to ProgressBar renders a 0%-width fill instead, so the bar
  // vanishes and the row loses its only visual.
  it('still draws a bar when the window is untouched', () => {
    render(
      <AiQuota
        config={{ type: 'ai-quota' } as never}
        data={{
          provider: 'codex',
          windows: [{ label: 'primary', usedPercent: 0, windowMinutes: 300, resetsAt: Date.now() + 3600000 }],
        }}
      />,
    );
    expect(screen.getByRole('img', { name: 'primary' })).toBeInTheDocument();
  });

  it('falls back to the provider name, and honours title-url when given', () => {
    const fallback = render(<AiQuota config={{ type: 'ai-quota' } as never} data={{ provider: 'codex', windows: WINDOWS }} />);
    expect(screen.getByText('codex quota')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'codex quota' })).toBeNull();
    fallback.unmount();

    render(
      <AiQuota
        config={{ type: 'ai-quota', 'title-url': 'https://example.com/quota' } as never}
        data={{ provider: 'codex', windows: WINDOWS }}
      />,
    );
    expect(screen.getByRole('link', { name: 'codex quota' })).toHaveAttribute(
      'href',
      'https://example.com/quota',
    );
  });

  it('applies css-class to the card chrome', () => {
    const { container } = render(
      <AiQuota
        config={{ type: 'ai-quota', 'css-class': 'mine' } as never}
        data={{ provider: 'codex', windows: WINDOWS }}
      />,
    );
    expect(container.querySelector('.mine')).not.toBeNull();
  });

  it('fails quietly when show-errors is false, but still reports the failure', () => {
    render(
      <AiQuota
        config={{ type: 'ai-quota', title: 'Quota', 'show-errors': false } as never}
        data={null}
        error="upstream exploded"
      />,
    );
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/upstream exploded/)).toBeNull();
    // quiet is never invisible
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
  });

  it('shouts by default, so show-errors stays opt-out rather than opt-in', () => {
    render(<AiQuota config={{ type: 'ai-quota', title: 'Quota' } as never} data={null} error="upstream exploded" />);
    expect(screen.getByRole('alert')).toHaveTextContent('upstream exploded');
  });
});
