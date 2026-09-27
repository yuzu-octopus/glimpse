import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Tailscale from './index';
import type { TailscaleData } from '../../../shared/widgets/payloads';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

const data: TailscaleData = {
  devices: [
    {
      id: 'nAAAA',
      name: 'nas.home.arpa',
      online: true,
      os: 'linux',
      clientVersion: '1.90.2',
      address: '100.101.102.103',
      lastSeen: null,
      exitNode: true,
    },
    {
      id: 'nBBBB',
      name: 'laptop.home.arpa',
      online: false,
      os: 'macOS',
      clientVersion: '1.88.0',
      address: '100.64.7.7',
      lastSeen: hoursAgo(3),
      exitNode: false,
    },
  ],
};

describe('tailscale widget', () => {
  it('shows the tailnet default title when the config names none', () => {
    render(<Tailscale config={{ type: 'tailscale' }} data={data} />);
    expect(screen.getByText('Tailnet')).toBeInTheDocument();
  });

  it('renders each node with its 100.x address in the code face', () => {
    render(<Tailscale config={{ type: 'tailscale' }} data={data} />);
    expect(screen.getByText('nas.home.arpa')).toBeInTheDocument();
    expect(screen.getByText('laptop.home.arpa')).toBeInTheDocument();
    expect(screen.getByText('100.101.102.103')).toHaveAttribute('data-type', 'code');
    expect(screen.getByText('100.64.7.7')).toHaveAttribute('data-type', 'code');
  });

  it('gives online nodes a success dot and offline ones a muted dot', () => {
    render(<Tailscale config={{ type: 'tailscale' }} data={data} />);
    expect(screen.getAllByTestId('ts-dot-online')).toHaveLength(1);
    expect(screen.getAllByTestId('ts-dot-offline')).toHaveLength(1);
    expect(screen.getByTestId('ts-dot-online')).toHaveAttribute('aria-label', 'nas.home.arpa is online');
    expect(screen.getByTestId('ts-dot-offline')).toHaveAttribute(
      'aria-label',
      'laptop.home.arpa is offline',
    );
  });

  it('reports os and version for a reachable node, and its last-seen age for an offline one', () => {
    render(<Tailscale config={{ type: 'tailscale' }} data={data} />);
    expect(screen.getByText('linux · 1.90.2')).toHaveAttribute('data-type', 'supporting');
    // A connected node sends lastSeen: null, so its row must not claim an age.
    expect(screen.getAllByTestId('ts-lastseen')).toHaveLength(1);
    expect(screen.getByTestId('ts-lastseen')).toHaveTextContent('seen 3h ago');
  });

  it('marks the exit node and leaves the other rows unbadged', () => {
    render(<Tailscale config={{ type: 'tailscale' }} data={data} />);
    expect(screen.getAllByTestId('ts-exit')).toHaveLength(1);
    expect(screen.getByTestId('ts-exit')).toHaveTextContent('exit node');
  });

  it('omits the address column for a node with no 100.x address', () => {
    const data2: TailscaleData = {
      devices: [{ ...data.devices[0], address: null }],
    };
    render(<Tailscale config={{ type: 'tailscale' }} data={data2} />);
    expect(screen.queryByTestId('ts-address')).toBeNull();
    expect(screen.getByText('nas.home.arpa')).toBeInTheDocument();
  });

  it('says "offline" rather than inventing an age when lastSeen is missing', () => {
    const data2: TailscaleData = {
      devices: [{ ...data.devices[1], id: 'nD', lastSeen: null }],
    };
    render(<Tailscale config={{ type: 'tailscale' }} data={data2} />);
    expect(screen.queryByTestId('ts-lastseen')).toBeNull();
    expect(screen.getByText('offline')).toBeInTheDocument();
  });

  it('renders a malformed lastSeen timestamp as zero rather than NaN', () => {
    const data2: TailscaleData = {
      devices: [{ ...data.devices[1], id: 'nE', lastSeen: 'not-a-date' }],
    };
    render(<Tailscale config={{ type: 'tailscale' }} data={data2} />);
    expect(screen.getByTestId('ts-lastseen')).toHaveTextContent('seen 0s ago');
  });

  it('collapses a long tailnet behind a show-more toggle', () => {
    const many: TailscaleData = {
      devices: Array.from({ length: 14 }, (_, i) => ({
        ...data.devices[0],
        id: `n${i}`,
        name: `node-${i}.home.arpa`,
      })),
    };
    render(<Tailscale config={{ type: 'tailscale' }} data={many} />);
    expect(screen.queryByText('node-12.home.arpa')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show more (4)' })).toBeInTheDocument();
  });

  it('shows the loading skeleton before any payload arrives', () => {
    render(<Tailscale config={{ type: 'tailscale' }} data={null} />);
    expect(screen.getByTestId('widget-loading')).toBeInTheDocument();
  });

  it('surfaces a fetch failure through the chrome and the header dot', () => {
    render(<Tailscale config={{ type: 'tailscale' }} data={null} error="tailscale: 401" />);
    expect(screen.getByText('tailscale: 401')).toBeInTheDocument();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
  });

  it('stays quiet when show-errors is false, but keeps the header dot', () => {
    render(
      <Tailscale
        config={{ type: 'tailscale', 'show-errors': false }}
        data={null}
        error="tailscale: 401"
      />,
    );
    expect(screen.queryByText('tailscale: 401')).toBeNull();
    expect(screen.getByTestId('widget-error-dot')).toBeInTheDocument();
  });
});
