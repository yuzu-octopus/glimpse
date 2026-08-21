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
    render(<SystemStats config={baseConfig} data={null} />);
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

  it('renders loading chrome when isLoading', () => {
    render(<SystemStats config={baseConfig} data={null} isLoading />);
    // placeholder not shown when loading; Chrome shows skeleton (no rows)
    expect(screen.queryByText('No data — not running on homelab host')).not.toBeInTheDocument();
  });
});
