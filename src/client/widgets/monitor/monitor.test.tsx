import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Monitor from './index';

const sites = [
  { url: 'https://example.com', title: 'Example', ok: true, status: 200, ms: 120 },
  { url: 'https://broken.example', title: 'Broken', ok: false, status: 500, ms: 3000 },
];

describe('monitor widget', () => {
  it('renders site rows with status and latency', () => {
    render(<Monitor config={{ type: 'monitor', title: 'Uptime', sites: [{ url: 'https://example.com' }] }} data={{ sites }} />);
    expect(screen.getByText('Uptime')).toBeInTheDocument();
    expect(screen.getByText('Example')).toBeInTheDocument();
    expect(screen.getByText('Broken')).toBeInTheDocument();
    expect(screen.getByText('120 ms')).toBeInTheDocument();
    expect(screen.getByText('3000 ms')).toBeInTheDocument();
  });

  it('shows a dash when latency is unknown', () => {
    render(
      <Monitor
        config={{ type: 'monitor', sites: [{ url: 'https://x.example' }] }}
        data={{ sites: [{ url: 'https://x.example', title: 'X', ok: false, status: null, ms: null }] }}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('filters to failing sites when show-failing-only is set', () => {
    render(<Monitor config={{ type: 'monitor', 'show-failing-only': true, sites: [{ url: 'https://example.com' }] }} data={{ sites }} />);
    expect(screen.getByText('Broken')).toBeInTheDocument();
    expect(screen.queryByText('Example')).toBeNull();
  });
});
