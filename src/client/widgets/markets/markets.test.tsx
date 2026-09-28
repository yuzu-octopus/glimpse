import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Markets, { TrendChart } from './index';
import styles from './markets.module.css';
import { CHART_HUES } from '../../kit/chart-hues';
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

  it('renders one bar per point and nothing for a series too short to plot', () => {
    const values = Array.from({ length: 21 }, (_, i) => 100 + i);
    const { container, rerender } = render(<TrendChart symbol="AAPL" values={values} />);
    expect(container.querySelectorAll('rect')).toHaveLength(21);
    rerender(<TrendChart symbol="AAPL" values={[]} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('labels every sparkline uniquely for screen readers', () => {
    render(
      <Markets
        config={{ type: 'markets', markets: [{ symbol: 'AAPL' }, { symbol: 'BTC-USD' }] }}
        data={{ markets }}
      />,
    );
    expect(screen.getByRole('img', { name: 'AAPL price trend' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'BTC-USD price trend' })).toBeInTheDocument();
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
    expect(container.querySelector('rect')).not.toBeNull();
  });

  // The exact token is upstream's to change — 0.3.1 repointed the kit's
  // sparkline from --dracula-* primitives to --color-data-* role tokens with
  // no visual delta — so assert the CHART_HUES entry, which is the contract
  // this repo actually owns, rather than a string the kit happens to print.
  it('paints the series green when it rises, red when it falls, and muted when flat', () => {
    const { container, rerender } = render(<TrendChart symbol="X" values={[1, 2, 3]} />);
    expect(container.querySelector('rect')).toHaveAttribute('fill', CHART_HUES.green);
    rerender(<TrendChart symbol="X" values={[3, 2, 1]} />);
    expect(container.querySelector('rect')).toHaveAttribute('fill', CHART_HUES.red);
    // no sign to show: the kit's muted hue, not a status hue
    rerender(<TrendChart symbol="X" values={[2, 2, 2]} />);
    const flat = container.querySelector('rect')!;
    expect(flat.closest('span')).toHaveClass(styles.sparkFlat);
    expect(flat.closest('span')).toHaveStyle({ '--spark-hue': CHART_HUES.muted });
  });
  it('draws the flat-series override from the hue variable, never a literal', () => {
    const rule = css.match(/\.sparkFlat rect\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toContain('fill: var(--spark-hue)');
    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    // no entrance choreography
    expect(css).not.toContain('animation');
  });


  // A four-row card from a five-symbol config reads as complete. The videos
  // widget already reports a dead source this way; markets dropped the
  // rejection on the floor and rendered the four that worked.
  it('reports each symbol that failed alongside the ones that worked', () => {
    render(
      <Markets
        config={{ type: 'markets', markets: [{ symbol: 'AAPL' }, { symbol: 'DEAD' }] }}
        data={{
          markets,
          issues: [{ symbol: 'DEAD', reason: 'HTTP 500' }],
        }}
      />,
    );
    expect(screen.getByTestId('markets-issues')).toBeInTheDocument();
    expect(screen.getByTestId('markets-source-dot')).toBeInTheDocument();
    expect(screen.getByText('DEAD')).toBeInTheDocument();
    expect(screen.getByText('HTTP 500')).toBeInTheDocument();
    // The symbols that did answer are still on screen — a status, not a Banner.
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('212.5')).toBeInTheDocument();
  });

  it('adds no notice chrome when every symbol answered', () => {
    const { container } = render(
      <Markets
        config={{ type: 'markets', markets: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }] }}
        data={{ markets, issues: [] }}
      />,
    );
    expect(screen.queryByTestId('markets-issues')).toBeNull();
    expect(container.querySelector('[class*="notice"]')).toBeNull();
  });
});
