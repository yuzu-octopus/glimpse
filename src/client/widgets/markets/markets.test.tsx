import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Markets, { Sparkline } from './index';
import styles from './markets.module.css';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Vitest serves CSS modules as a class-name proxy, so the token bindings are
// only observable in the stylesheet source itself.
const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'markets.module.css'), 'utf8');

const markets = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 212.5,
    change: 3.25,
    changePct: 1.55,
    chart: [200, 202, 198, 205, 210, 212.5],
  },
  {
    symbol: 'BTC-USD',
    name: 'Bitcoin',
    price: 64000,
    change: -1200,
    changePct: -1.84,
    chart: [66000, 65000, 64500, 64000],
  },
];

describe('markets widget', () => {
  it('renders symbol, name, price and change with sign and pct', () => {
    render(<Markets config={{ type: 'markets', title: 'Markets', markets: [{ symbol: 'AAPL' }] }} data={{ markets }} />);
    expect(screen.getByText('Markets')).toBeInTheDocument();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('Apple Inc.')).toBeInTheDocument();
    expect(screen.getByText('212.5')).toBeInTheDocument();
    expect(screen.getByText('3.25 (1.55%)')).toBeInTheDocument();
    expect(screen.getByText('-1,200 (-1.84%)')).toBeInTheDocument();
  });

  it('renders a placeholder price when data is missing', () => {
    render(
      <Markets
        config={{ type: 'markets', markets: [{ symbol: 'X' }] }}
        data={{ markets: [{ symbol: 'X', name: 'X Corp', price: null, change: null, changePct: null, chart: [] }] }}
      />,
    );
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('sparkline renders a polyline for a 21-point series and nothing for a flat/empty series', () => {
    const values = Array.from({ length: 21 }, (_, i) => 100 + i);
    const { container, rerender } = render(<Sparkline values={values} />);
    expect(container.querySelector('polyline')).not.toBeNull();
    rerender(<Sparkline values={[]} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('resolves symbol links from the template with {SYMBOL}', () => {
    render(
      <Markets
        config={{
          type: 'markets',
          markets: [{ symbol: 'AAPL' }],
          'symbol-link-template': 'https://www.google.com/search?tbm=nws&q={SYMBOL}',
          'chart-link-template': 'https://www.tradingview.com/chart/?symbol={SYMBOL}',
        }}
        data={{ markets }}
      />,
    );
    const symbolLink = screen.getByRole('link', { name: 'AAPL' });
    expect(symbolLink).toHaveAttribute('href', 'https://www.google.com/search?tbm=nws&q=AAPL');
    expect(symbolLink).toHaveAttribute('target', '_blank');
    const chartLink = screen.getByRole('link', { name: 'AAPL chart' });
    expect(chartLink).toHaveAttribute('href', 'https://www.tradingview.com/chart/?symbol=AAPL');
    expect(chartLink).toHaveAttribute('target', '_blank');
  });

  it('per-market symbol-link and chart-link override the templates', () => {
    render(
      <Markets
        config={{
          type: 'markets',
          markets: [
            {
              symbol: 'AAPL',
              'symbol-link': 'https://news.example.com/apple',
              'chart-link': 'https://charts.example.com/aapl',
            },
          ],
          'symbol-link-template': 'https://template.example.com/{SYMBOL}',
          'chart-link-template': 'https://template.example.com/chart/{SYMBOL}',
        }}
        data={{ markets }}
      />,
    );
    expect(screen.getByRole('link', { name: 'AAPL' })).toHaveAttribute(
      'href',
      'https://news.example.com/apple',
    );
    expect(screen.getByRole('link', { name: 'AAPL chart' })).toHaveAttribute(
      'href',
      'https://charts.example.com/aapl',
    );
  });

  it('renders plain text and an unlinked sparkline when no link resolves', () => {
    const { container } = render(
      <Markets
        config={{ type: 'markets', markets: [{ symbol: 'X' }] }}
        data={{ markets: [{ symbol: 'X', name: 'X Corp', price: null, change: null, changePct: null, chart: [1, 2, 3] }] }}
      />,
    );
    expect(screen.getByText('X')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'X' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'X chart' })).toBeNull();
    // the sparkline still renders, just not wrapped in an anchor
    expect(container.querySelector('polyline')).not.toBeNull();
  });

  it('sparkline line follows the series direction', () => {
    const { container, rerender } = render(<Sparkline values={[1, 2, 3]} />);
    expect(container.querySelector('polyline')).toHaveClass(styles.sparkUp);
    rerender(<Sparkline values={[3, 2, 1]} />);
    expect(container.querySelector('polyline')).toHaveClass(styles.sparkDown);
    // no sign to show: the sequential ramp, not a status hue
    rerender(<Sparkline values={[2, 2, 2]} />);
    expect(container.querySelector('polyline')).toHaveClass(styles.sparkFlat);
  });

  it('sparkline draws its baseline as the chart grid', () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} />);
    expect(container.querySelector('line')).toHaveClass(styles.sparkGrid);
  });

  it('binds the sparkline to the data palette and the gridline token', () => {
    const rule = (selector: string) => css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? '';
    expect(rule('\\.sparkUp')).toContain('var(--color-data-categorical-green)');
    expect(rule('\\.sparkDown')).toContain('var(--color-data-categorical-red)');
    expect(rule('\\.sparkFlat')).toContain('var(--color-data-blue-1)');
    expect(rule('\\.sparkGrid')).toContain('var(--color-graph-gridlines)');
    // no entrance choreography
    expect(css).not.toContain('animation');
  });
});
