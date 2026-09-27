import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Monitor from './index';
import styles from './monitor.module.css';

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

  it('shows the HTTP status code the check came back with', () => {
    render(<Monitor config={{ type: 'monitor', sites: [{ url: 'https://example.com' }] }} data={{ sites }} />);
    // fetched for every site, rendered by nothing before
    expect(screen.getByText('200')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('omits the status code for a source that never reports one', () => {
    render(
      <Monitor
        config={{ type: 'monitor', 'kuma-url': 'https://kuma.lab', 'kuma-slug': 'homelab' }}
        data={{ sites: [{ url: 'https://healthchecks.io', title: 'Cron sync', ok: true, status: null, ms: 12, errorUrl: null, sameTab: false }] }}
      />,
    );
    // no phantom 0 in the code's place
    expect(document.querySelector(`.${styles.status}`)).toBeNull();
    expect(screen.getByText('12 ms')).toBeInTheDocument();
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

  it('renders kuma/healthchecks source rows through the same renderer', () => {
    // Source-mapped payloads use the MonitorSite shape with null status/ms;
    // no client change needed — this pins the reuse contract.
    render(
      <Monitor
        config={{ type: 'monitor', title: 'Uptime', 'kuma-url': 'https://kuma.lab', 'kuma-slug': 'homelab' }}
        data={{
          sites: [
            { url: 'https://grafana.lab', title: 'Grafana', ok: true, status: 200, ms: 42, errorUrl: null, sameTab: false },
            { url: 'https://healthchecks.io', title: 'Cron sync', ok: false, status: null, ms: null, errorUrl: null, sameTab: false },
          ],
        }}
      />,
    );
    expect(screen.getByText('Grafana')).toBeInTheDocument();
    expect(screen.getByText('42 ms')).toBeInTheDocument();
    expect(screen.getByText('Cron sync')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders a per-site icon, resolved through the shared icon shorthands', () => {
    const { container } = render(
      <Monitor
        config={{
          type: 'monitor',
          sites: [
            { url: 'https://example.com', icon: 'si:example' },
            { url: 'https://plain.example', icon: 'https://cdn.example/logo.png' },
            { url: 'https://none.example' },
          ],
        }}
        data={{
          sites: [
            { url: 'https://example.com', title: 'Example', ok: true, status: 200, ms: 1, errorUrl: null, sameTab: false },
            { url: 'https://plain.example', title: 'Plain', ok: true, status: 200, ms: 1, errorUrl: null, sameTab: false },
            { url: 'https://none.example', title: 'None', ok: true, status: 200, ms: 1, errorUrl: null, sameTab: false },
          ],
        }}
      />,
    );
    const imgs = [...container.querySelectorAll('img')] as HTMLImageElement[];
    expect(imgs).toHaveLength(2);
    expect(imgs[0]!.getAttribute('src')).toBe('https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/example.svg');
    // si: glyphs are black paths with no fill — invisible on a dark theme
    expect(imgs[0]!.className).toContain(styles.iconAutoInvert);
    expect(imgs[1]!.getAttribute('src')).toBe('https://cdn.example/logo.png');
    expect(imgs[1]!.className).not.toContain(styles.iconAutoInvert);
  });

  it('gives no icon to a site that came from kuma or healthchecks', () => {
    const { container } = render(
      <Monitor
        config={{ type: 'monitor', 'kuma-url': 'https://kuma.lab', 'kuma-slug': 'homelab' }}
        data={{ sites: [{ url: 'https://grafana.lab', title: 'Grafana', ok: true, status: 200, ms: 1, errorUrl: null, sameTab: false }] }}
      />,
    );
    expect(container.querySelector(`.${styles.icon}`)).toBeNull();
  });

  it('drops the icon, not the row, when the image fails to load', () => {
    const { container } = render(
      <Monitor
        config={{ type: 'monitor', sites: [{ url: 'https://example.com', icon: 'https://cdn.example/gone.png' }] }}
        data={{ sites: [{ url: 'https://example.com', title: 'Example', ok: true, status: 200, ms: 1, errorUrl: null, sameTab: false }] }}
      />,
    );
    fireEvent.error(container.querySelector(`.${styles.icon}`)!);
    expect(container.querySelector(`.${styles.icon}`)).toBeNull();
    expect(screen.getByText('Example')).toBeInTheDocument();
  });

  it('surfaces a fetch error via the widget chrome', () => {
    render(
      <Monitor config={{ type: 'monitor', title: 'Uptime', sites: [{ url: 'https://example.com' }] }} data={null} error="monitor fetch failed" />,
    );
    expect(screen.getByText('monitor fetch failed')).toBeInTheDocument();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
    expect(screen.queryByText('Example')).toBeNull();
  });
});
