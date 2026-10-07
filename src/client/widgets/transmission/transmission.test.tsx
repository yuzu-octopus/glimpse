import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Transmission from './index';
import type { TorrentData } from '../../../shared/widgets/payloads';

const data: TorrentData = {
  torrents: [
    { name: 'ubuntu.iso', progress: 0.42, state: 'downloading', size: 4_000_000_000, downloadSpeed: 12_000_000, uploadSpeed: 0, eta: 300 },
    { name: 'seed.mkv', progress: 1, state: 'seeding', size: 800_000_000, downloadSpeed: 0, uploadSpeed: 500_000, eta: null },
  ],
};

describe('transmission widget', () => {
  it('renders torrent rows with progress bars and states', () => {
    render(<Transmission config={{ type: 'transmission' }} data={data} />);
    expect(screen.getByText('Transmission')).toBeInTheDocument();
    expect(screen.getByText('ubuntu.iso')).toBeInTheDocument();
    expect(screen.getByTestId('torrent-state-seeding')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /ubuntu/ })).toHaveAttribute('aria-valuenow', '42');
  });

  it('shows a placeholder when empty', () => {
    render(<Transmission config={{ type: 'transmission' }} data={{ torrents: [] }} />);
    expect(screen.getByText(/No torrents/)).toBeInTheDocument();
  });

  it('shows loading skeleton while data is null', () => {
    render(<Transmission config={{ type: 'transmission' }} data={null} />);
    expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
  });

  it('surfaces fetch errors via chrome', () => {
    render(<Transmission config={{ type: 'transmission' }} data={null} error="transmission: RPC failed" />);
    expect(screen.getByText('transmission: RPC failed')).toBeInTheDocument();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
  });

  it('renders ETA for downloading torrents', () => {
    render(<Transmission config={{ type: 'transmission' }} data={data} />);
    // First torrent has eta: 300 → "5m left"
    expect(screen.getByText('5m left')).toBeInTheDocument();
  });

  it('renders no ETA when null', () => {
    render(<Transmission config={{ type: 'transmission' }} data={data} />);
    // Second torrent has eta: null — no "NaN" or "null" text
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.queryByText(/null/)).toBeNull();
  });

  it('renders file size', () => {
    render(<Transmission config={{ type: 'transmission' }} data={data} />);
    // First torrent: 4_000_000_000 bytes → "3.7 GB"
    expect(screen.getByText(/3\.7 GB/)).toBeInTheDocument();
  });

  it('renders download speed with down arrow', () => {
    render(<Transmission config={{ type: 'transmission' }} data={data} />);
    // First torrent: 12_000_000 bps → "11.4 MB/s"
    expect(screen.getByText(/11\.4 MB\/s/)).toBeInTheDocument();
  });

  it('renders upload speed with up arrow', () => {
    render(<Transmission config={{ type: 'transmission' }} data={data} />);
    // Second torrent: 500_000 B → "488 KB/s"; the arrow icon splits the
    // span's children, so the speed text matches the span itself.
    const speed = screen.getByText('488 KB/s');
    expect(speed).toBeInTheDocument();
    expect(speed.querySelector('svg')).toBeInTheDocument();
  });

  it('renders progress percentage', () => {
    render(<Transmission config={{ type: 'transmission' }} data={data} />);
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders both torrent rows', () => {
    render(<Transmission config={{ type: 'transmission' }} data={data} />);
    expect(screen.getAllByTestId('torrent-row')).toHaveLength(2);
  });
});
