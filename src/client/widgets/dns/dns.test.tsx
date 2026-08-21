import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DnsStatsWidget } from './index';
import type { DnsStats } from '../../../shared/widgets/payloads';

function sample(overrides: Partial<DnsStats> = {}): DnsStats {
  const series = Array.from({ length: 8 }, (_, i) => ({
    queries: 100 + i * 10,
    blocked: 20 + i,
    percentBlocked: 20,
    percentTotal: i === 7 ? 100 : 80 - i * 5,
  }));
  return {
    totalQueries: 1234,
    blockedPercent: 23,
    responseTime: 0,
    domainsBlocked: 120_000,
    series,
    timeLabels: ['12am', '3am', '6am', '9am', '12pm', '3pm', '6pm', '9pm'],
    topBlockedDomains: [
      { domain: 'ads.example', percentBlocked: 40 },
      { domain: 'track.example', percentBlocked: 10 },
    ],
    ...overrides,
  };
}

const baseConfig = { type: 'dns-stats', title: 'DNS', url: 'http://pi.local' } as unknown as Record<string, unknown>;

describe('DnsStats client', () => {
  it('renders totals: QUERIES/BLOCKED/DOMAINS when responseTime is 0', () => {
    render(<DnsStatsWidget config={baseConfig} data={sample({ responseTime: 0, domainsBlocked: 50_000 })} />);
    expect(screen.getAllByText('QUERIES').length).toBeGreaterThan(0);
    expect(screen.getAllByText('BLOCKED').length).toBeGreaterThan(0);
    expect(screen.getByText('DOMAINS')).toBeInTheDocument();
    expect(screen.getByTestId('dns-total').textContent).toMatch(/1,234/);
    expect(screen.getByTestId('dns-blocked').textContent).toBe('23%');
    expect(screen.getByTestId('dns-domains').textContent).toMatch(/50/);
  });

  it('renders LATENCY instead of DOMAINS when responseTime > 0', () => {
    render(<DnsStatsWidget config={baseConfig} data={sample({ responseTime: 12 })} />);
    expect(screen.getByText('LATENCY')).toBeInTheDocument();
    expect(screen.queryByText('DOMAINS')).not.toBeInTheDocument();
    expect(screen.getByTestId('dns-latency').textContent).toMatch(/12ms/);
  });

  it('renders graph with 8 columns and hover tips', () => {
    render(<DnsStatsWidget config={baseConfig} data={sample()} />);
    const cols = screen.getAllByTestId('dns-column');
    expect(cols).toHaveLength(8);
    expect(screen.getByTestId('dns-graph')).toBeInTheDocument();
    expect(screen.getAllByTestId('dns-tip')[0].textContent).toMatch(/QUERIES/);
    expect(screen.getAllByTestId('dns-bar')).toHaveLength(8);
    expect(screen.getAllByTestId('dns-time')[0].textContent).toBe('12am');
  });

  it('hides graph when hide-graph is true', () => {
    render(<DnsStatsWidget config={{ ...baseConfig, 'hide-graph': true }} data={sample()} />);
    expect(screen.queryByTestId('dns-graph')).not.toBeInTheDocument();
  });

  it('hides graph when series is empty', () => {
    render(<DnsStatsWidget config={baseConfig} data={sample({ series: [] })} />);
    expect(screen.queryByTestId('dns-graph')).not.toBeInTheDocument();
  });

  it('renders top blocked domains and toggles details', () => {
    render(<DnsStatsWidget config={baseConfig} data={sample()} />);
    const details = screen.getByTestId('dns-details');
    expect(details).toBeInTheDocument();
    expect(screen.getByText('Top blocked domains')).toBeInTheDocument();
    expect(screen.getByText('ads.example')).toBeInTheDocument();
    expect(screen.getAllByTestId('dns-domain-row')).toHaveLength(2);
    expect(screen.getAllByTestId('dns-domain-row')[0].textContent).toMatch(/40%/);
  });

  it('hides top domains when hide-top-domains is true', () => {
    render(<DnsStatsWidget config={{ ...baseConfig, 'hide-top-domains': true }} data={sample()} />);
    expect(screen.queryByTestId('dns-details')).not.toBeInTheDocument();
  });

  it('shows loading chrome when isLoading', () => {
    render(<DnsStatsWidget config={baseConfig} data={null} isLoading />);
    expect(screen.queryByTestId('dns-root')).not.toBeInTheDocument();
  });

  it('surfaces error', () => {
    render(<DnsStatsWidget config={baseConfig} data={null} error="dns fetch failed" />);
    expect(screen.getByText('dns fetch failed')).toBeInTheDocument();
  });

  it('svg gridlines have 5 lines at 1,25,50,75,99', () => {
    const { container } = render(<DnsStatsWidget config={baseConfig} data={sample()} />);
    const lines = container.querySelectorAll('svg line');
    expect(lines).toHaveLength(5);
    const ys = Array.from(lines).map((l) => l.getAttribute('y1'));
    expect(ys).toEqual(['1', '25', '50', '75', '99']);
  });
});
