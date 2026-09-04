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
});
