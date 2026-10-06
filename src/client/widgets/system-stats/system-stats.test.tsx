import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SystemStats } from './index';
import type { SystemStatsData } from '../../../shared/widgets/payloads';

const baseConfig = { type: 'system-stats' } as unknown as Record<string, unknown>;

const sampleData: SystemStatsData = {
  cpu: { cores: 8, speed: 3.2, load: 42 },
  mem: { total: 16e9, used: 8e9, free: 8e9 },
  fs: [{ fs: '/dev/sda1', size: 500e9, used: 100e9, use: 20, mount: '/' }],
  temp: 55,
  gpu: [{ model: 'M5', temp: 60 }],
  battery: { percent: 85, status: 'Discharging', powerW: null, health: 91, onAc: false, hoursRemaining: 2 },
  uptimeHrs: 48.5,
  load1m: 1.5,
  fanRpm: 1200,
  gpuLoad: 35,
};

describe('SystemStats client', () => {
  it('shows placeholder when cpu null (not on homelab)', () => {
    const nullData: SystemStatsData = { cpu: null, mem: null, fs: [], temp: null, gpu: [], battery: null, uptimeHrs: null, load1m: null, fanRpm: null, gpuLoad: null };
    render(<SystemStats config={baseConfig} data={nullData} />);
    expect(screen.getByText('No data — not running on homelab host')).toBeInTheDocument();
  });

  it('shows placeholder when data is null', () => {
    render(<SystemStats config={baseConfig} data={null} isLoading={false} />);
    expect(screen.getByText('No data — not running on homelab host')).toBeInTheDocument();
  });

  it('renders rows when data present', () => {
    render(<SystemStats config={baseConfig} data={sampleData} />);
    expect(screen.getByText(/8 cores/)).toBeInTheDocument();
    expect(screen.getByText(/MEM/i)).toBeInTheDocument();
    expect(screen.getByText('DISK')).toBeInTheDocument();
    // The mount is the row's value and the byte pair is its sub — the split
    // that keeps `/` from being buried behind a truncated size string.
    expect(screen.getByText('/')).toBeInTheDocument();
    expect(screen.getByText('100.0 GB / 500.0 GB')).toBeInTheDocument();
    expect(screen.getByText('TEMP')).toBeInTheDocument();
    expect(screen.getByText('GPU')).toBeInTheDocument();
    // placeholder should not appear
    expect(screen.queryByText('No data — not running on homelab host')).not.toBeInTheDocument();
  });

  it('inks the utilisation — every loaded row carries a meter at its own percent', () => {
    render(<SystemStats config={baseConfig} data={sampleData} />);
    const bar = (name: string) => screen.getByRole('meter', { name });
    expect(bar('CPU load')).toHaveAttribute('aria-valuenow', '42');
    expect(bar('MEM load')).toHaveAttribute('aria-valuenow', '50'); // 8/16 GB
    expect(bar('DISK load')).toHaveAttribute('aria-valuenow', '20');
    expect(bar('TEMP load')).toHaveAttribute('aria-valuenow', '55');
    expect(bar('GPU load')).toHaveAttribute('aria-valuenow', '60');
  });

  it('escalates the fill at 85% and flips to the negative hue at 95%', () => {
    const stateAt = (use: number) => {
      const { unmount } = render(
        <SystemStats config={baseConfig} data={{ ...sampleData, fs: [{ ...sampleData.fs[0], use }] }} />,
      );
      const disk = screen.getByRole('meter', { name: 'DISK load' });
      const out = [disk.getAttribute('data-high'), disk.getAttribute('data-critical')];
      unmount();
      return out;
    };
    expect(stateAt(5)).toEqual([null, null]);
    expect(stateAt(84)).toEqual([null, null]);
    expect(stateAt(85)).toEqual(['true', null]);
    expect(stateAt(94)).toEqual(['true', null]);
    expect(stateAt(95)).toEqual(['true', 'true']);
  });

  it('draws no bar for a row with no measurable load', () => {
    render(<SystemStats config={baseConfig} data={{ ...sampleData, gpu: [{ model: 'M5', temp: null }] }} />);
    expect(screen.queryByRole('meter', { name: 'GPU load' })).toBeNull();
  });

  it('suppresses a real payload while loading', () => {
    render(<SystemStats config={baseConfig} data={sampleData} isLoading />);
    // Asserting only the absent placeholder passes for a renderer that emits
    // nothing at all. The skeleton and the suppressed meters are the
    // consumer-visible pair.
    expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
    expect(screen.queryByRole('meter', { name: 'CPU load' })).toBeNull();
    expect(screen.queryByText('No data — not running on homelab host')).not.toBeInTheDocument();
  });

  it('renders battery row with percent and status', () => {
    render(<SystemStats config={baseConfig} data={sampleData} />);
    expect(screen.getByText(/BATTERY/i)).toBeInTheDocument();
    expect(screen.getByText(/85% Discharging/)).toBeInTheDocument();
    expect(screen.getByText(/2h remaining/)).toBeInTheDocument();
  });

  it('renders uptime row', () => {
    render(<SystemStats config={baseConfig} data={sampleData} />);
    expect(screen.getByText(/UPTIME/i)).toBeInTheDocument();
    expect(screen.getByText(/48.5h/)).toBeInTheDocument();
  });

  it('renders load row', () => {
    render(<SystemStats config={baseConfig} data={sampleData} />);
    expect(screen.getAllByText(/LOAD/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/1.50/)).toBeInTheDocument();
  });

  it('renders fan row', () => {
    render(<SystemStats config={baseConfig} data={sampleData} />);
    expect(screen.getByText(/FAN/i)).toBeInTheDocument();
    expect(screen.getByText(/1200 RPM/)).toBeInTheDocument();
  });

  it('renders gpu load row with meter', () => {
    render(<SystemStats config={baseConfig} data={sampleData} />);
    expect(screen.getByText(/GPU LOAD/i)).toBeInTheDocument();
    expect(screen.getByText(/35%/)).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'GPU LOAD load' })).toHaveAttribute('aria-valuenow', '35');
  });

  it('omits battery row when battery is null', () => {
    render(<SystemStats config={baseConfig} data={{ ...sampleData, battery: null }} />);
    expect(screen.queryByText(/BATTERY/i)).toBeNull();
  });

  it('omits uptime row when uptimeHrs is null', () => {
    render(<SystemStats config={baseConfig} data={{ ...sampleData, uptimeHrs: null }} />);
    expect(screen.queryByText(/UPTIME/i)).toBeNull();
  });

  it('omits fan row when fanRpm is null', () => {
    render(<SystemStats config={baseConfig} data={{ ...sampleData, fanRpm: null }} />);
    expect(screen.queryByText(/FAN/i)).toBeNull();
  });

  it('omits gpu load row when gpuLoad is null', () => {
    render(<SystemStats config={baseConfig} data={{ ...sampleData, gpuLoad: null }} />);
    expect(screen.queryByText(/GPU LOAD/i)).toBeNull();
  });
});
