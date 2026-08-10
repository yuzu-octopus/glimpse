import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Monitor from './index';

const sites = [
  { url: 'https://example.com', title: 'Example', ok: true, status: 200, ms: 120, errorUrl: null, sameTab: false },
  { url: 'https://broken.example', title: 'Broken', ok: false, status: 500, ms: 3000, errorUrl: null, sameTab: false },
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
        data={{ sites: [{ url: 'https://x.example', title: 'X', ok: false, status: null, ms: null, errorUrl: null, sameTab: false }] }}
      />,
    );
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('filters to failing sites when show-failing-only is set', () => {
    render(<Monitor config={{ type: 'monitor', 'show-failing-only': true, sites: [{ url: 'https://example.com' }] }} data={{ sites }} />);
    expect(screen.getByText('Broken')).toBeInTheDocument();
    expect(screen.queryByText('Example')).toBeNull();
  });

  it('links to error-url when down and error-url is set', () => {
    render(
      <Monitor
        config={{ type: 'monitor', sites: [{ url: 'https://example.com', 'error-url': 'https://status.example.com' }] }}
        data={{
          sites: [
            { url: 'https://example.com', title: 'Down site', ok: false, status: 500, ms: 10, errorUrl: 'https://status.example.com', sameTab: false },
          ],
        }}
      />,
    );
    const link = screen.getByRole('link', { name: 'Down site' });
    expect(link).toHaveAttribute('href', 'https://status.example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('links to url when up or no error-url, and honors same-tab', () => {
    render(
      <Monitor
        config={{ type: 'monitor', sites: [{ url: 'https://example.com', 'same-tab': true }] }}
        data={{
          sites: [
            { url: 'https://example.com', title: 'Same tab site', ok: false, status: 500, ms: 10, errorUrl: 'https://status.example.com', sameTab: true },
            { url: 'https://up.example', title: 'Up site', ok: true, status: 200, ms: 5, errorUrl: null, sameTab: false },
          ],
        }}
      />,
    );
    expect(screen.getByRole('link', { name: 'Same tab site' })).toHaveAttribute('href', 'https://status.example.com');
    expect(screen.getByRole('link', { name: 'Same tab site' })).not.toHaveAttribute('target');
    expect(screen.getByRole('link', { name: 'Up site' })).toHaveAttribute('href', 'https://up.example');
    expect(screen.getByRole('link', { name: 'Up site' })).toHaveAttribute('target', '_blank');
  });
});
