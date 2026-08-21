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
  temp: { main: 42, isAvailable: true },
  gpu: [{ model: 'Apple M1', temp: 45 }],
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
    const bars = screen.getAllByRole('meter');
    expect(bars.length).toBeGreaterThanOrEqual(8); // cpu+gpu+ram+disk+temp per server
    const byLabel = (l: string) => bars.find((b) => b.getAttribute('aria-label') === l);
    expect(byLabel('CPU')).toHaveAttribute('aria-valuenow', '100'); // load 1.75 → 175% clamps to fill cap
    // GPU bar: 45°C → value 45
    expect(byLabel('GPU')).toHaveAttribute('aria-valuenow', '45');
    // RAM bar: 12/32 = 38%
    expect(byLabel('RAM')).toHaveAttribute('aria-valuenow', '38');
    // DISK bar: 250/500 = 50% (label may be "DISK /" or "DISK /System/Volumes/Data" depending on collapse)
    const diskBar = bars.find((b) => (b.getAttribute('aria-label') ?? '').startsWith('DISK'));
    expect(diskBar).toHaveAttribute('aria-valuenow', '50');
    // TEMP as big number in cell (not meter) — check text
    expect(screen.getAllByText('42°C').length).toBeGreaterThanOrEqual(1);
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
              temp: { main: null, isAvailable: false },
              gpu: [],
            },
          ],
        }}
      />,
    );
    // CPU + MEM bars show n/a; GPU/TEMP hidden when unavailable
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
