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
});
