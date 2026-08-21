import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ServerStats from './index';

const up = {
  name: 'yuzu-mac',
  hostname: 'yuzu-mac',
  platform: 'macOS',
  bootTime: new Date(Date.now() - 3600 * 1000).toISOString(),
  cpu: { load: 1.75, loadIsAvailable: true },
  memory: { used: 12e9, total: 32e9, isAvailable: true },
  mountpoints: [{ path: '/', used: 250e9, total: 500e9 }],
  isReachable: true,
};

const down = {
  name: 'box.lan',
  hostname: 'box.lan',
  platform: '',
  bootTime: '',
  cpu: { load: 0, loadIsAvailable: false },
  memory: { used: 0, total: 0, isAvailable: false },
  mountpoints: [],
  isReachable: false,
};

describe('server-stats widget', () => {
  it('renders multiple servers with names and stat bars', () => {
    render(
      <ServerStats
        config={{ type: 'server-stats', title: 'Servers' }}
        data={{ servers: [up, { ...up, name: 'second', hostname: 'second' }] }}
      />,
    );
    expect(screen.getByText('Servers')).toBeInTheDocument();
    expect(screen.getAllByText('yuzu-mac').length).toBeGreaterThan(0);
    expect(screen.getAllByText('second').length).toBeGreaterThan(0);
    // CPU bar shows load as percent (175% load clamps to 100 fill but text shows raw)
    const bars = screen.getAllByRole('meter');
    expect(bars.length).toBeGreaterThanOrEqual(6); // cpu+mem+disk per server
    expect(bars[0]).toHaveAttribute('aria-label', 'CPU');
    expect(bars[0]).toHaveAttribute('aria-valuenow', '100'); // load 1.75 → 175% clamps to fill cap
    // MEM bar: 12/32 = 38%
    expect(bars[1]).toHaveAttribute('aria-valuenow', '38');
    // DISK bar: 250/500 = 50%
    expect(bars[2]).toHaveAttribute('aria-label', 'DISK /');
    expect(bars[2]).toHaveAttribute('aria-valuenow', '50');
    // uptime rendered (1h ago)
    expect(screen.getAllByText('1h').length).toBeGreaterThan(0);
  });

  it('renders unreachable server with negative icon state and no bars', () => {
    render(<ServerStats config={{ type: 'server-stats' }} data={{ servers: [down] }} />);
    expect(screen.getAllByText('box.lan').length).toBeGreaterThan(0);
    expect(screen.queryByRole('meter')).toBeNull();
    // down icon carries the negative class
    const card = screen.getByTestId('server-card');
    expect(card.className).toMatch(/serverDown/);
  });

  it('renders n/a gray bars when metrics unavailable on a reachable server', () => {
    render(
      <ServerStats
        config={{ type: 'server-stats' }}
        data={{
          servers: [
            {
              ...up,
              bootTime: '',
              cpu: { load: 0, loadIsAvailable: false },
              memory: { used: 0, total: 0, isAvailable: false },
              mountpoints: [],
            },
          ],
        }}
      />,
    );
    // CPU + MEM bars show n/a; hover-details adds a third (CPU load row)
    expect(screen.getAllByText('n/a').length).toBeGreaterThanOrEqual(2);
    const bars = screen.getAllByRole('meter');
    for (const bar of bars) expect(bar).not.toHaveAttribute('aria-valuenow');
  });

  it('shows loading skeleton while data pending', () => {
    render(<ServerStats config={{ type: 'server-stats' }} data={null} isLoading />);
    expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
  });

  it('surfaces fetch errors via chrome', () => {
    render(<ServerStats config={{ type: 'server-stats' }} data={null} error="boom" />);
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
  });
});
