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
};

describe('SystemStats client', () => {
  it('shows placeholder when cpu null (not on homelab)', () => {
    const nullData: SystemStatsData = { cpu: null, mem: null, fs: [], temp: null, gpu: [] };
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
});
