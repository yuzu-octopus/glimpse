import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AiQuota } from './index';

describe('ai-quota widget', () => {
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

  const WINDOWS = [
    { label: 'primary', usedPercent: 15, windowMinutes: 300, resetsAt: Date.now() + 3600000 },
  ];

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
