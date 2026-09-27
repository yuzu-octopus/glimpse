import type { CSSProperties } from 'react';
import { Link } from '@astryxdesign/core';
import { MARKETS_DEFAULTS, type MarketsConfig } from '../../../shared/widgets/keyed';
import { CHART_HUES } from '../../kit/chart-hues';
import { Sparkline } from '../../kit/sparkline';
import { MetricDelta } from '../../kit/metric-delta';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { fmtNumber } from '../_helpers/fmtNumber';
import type { Market } from '../../../shared/widgets/payloads';
import styles from './markets.module.css';
void MARKETS_DEFAULTS;

/**
 * Kit sparkline in `range` mode — the kit's market-row geometry. The flat
 * case is the one thing the kit has no slot for: a directionless series has
 * no sign to show, so it takes CHART_HUES.muted instead of a status hue.
 */
export function TrendChart({ symbol, values }: { symbol: string; values: number[] }) {
  if (values.length < 2) return null;
  const last = values[values.length - 1]!;
  const first = values[0]!;
  const flat = last === first;
  return (
    <span
      className={flat ? `${styles.sparkline} ${styles.sparkFlat}` : styles.sparkline}
      style={flat ? ({ '--spark-hue': CHART_HUES.muted } as CSSProperties) : undefined}
    >
      <Sparkline
        data={values.map((value, i) => ({ id: `${symbol}-${i}`, value }))}
        label={`${symbol} price trend`}
        positive={!flat && last > first}
        mode="range"
        isCompact
      />
    </span>
  );
}

function Change({ change, changePct }: { change: number | null; changePct: number | null }) {
  if (change === null) return null;
  const text =
    fmtNumber(change, { maximumFractionDigits: 2 }) +
    (changePct !== null ? ` (${changePct.toFixed(2)}%)` : '');
  // glance colors strictly by sign; zero has no sign, so it stays neutral.
  if (change === 0) return <span className={styles.change}>{text}</span>;
  return (
    <span className={styles.change}>
      <MetricDelta value={text} positive={change > 0} />
    </span>
  );
}

/** glance precedence: per-market link > widget template > no link. */
function resolveLink(
  template: string | undefined,
  specific: string | undefined,
  symbol: string,
): string | undefined {
  if (specific) return specific;
  if (template) return template.replaceAll('{SYMBOL}', symbol);
  return undefined;
}

interface RowLinks {
  symbolLink?: string;
  chartLink?: string;
}

function Row({ market, symbolLink, chartLink }: { market: Market } & RowLinks) {
  const symbol = symbolLink ? (
    <Link href={symbolLink} target="_blank" className={styles.symbol} hasUnderline={false}>
      {market.symbol}
    </Link>
  ) : (
    <span className={styles.symbol}>{market.symbol}</span>
  );
  const sparkline = <TrendChart symbol={market.symbol} values={market.chart} />;
  return (
    <div className={styles.row}>
      <div className={styles.rowLeft}>
        {symbol}
        {market.name ? <span className={styles.name}>{market.name}</span> : null}
      </div>
      {chartLink ? (
        <Link href={chartLink} target="_blank" className={styles.chartLink} hasUnderline={false} label={`${market.symbol} chart`}>
          {sparkline}
        </Link>
      ) : (
        <span className={styles.chartLink}>{sparkline}</span>
      )}
      <div className={styles.values}>
        <Change change={market.change} changePct={market.changePct} />
        <span className={styles.price}>
          {market.price !== null ? fmtNumber(market.price, { maximumFractionDigits: 2 }) : '—'}
        </span>
      </div>
    </div>
  );
}

function Markets({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as MarketsConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const markets = ((data as { markets?: Market[] } | null)?.markets ?? []) as Market[];
  const links = new Map<string, RowLinks>(
    cfg.markets.map((m) => [
      m.symbol,
      {
        symbolLink: resolveLink(cfg['symbol-link-template'], m['symbol-link'], m.symbol),
        chartLink: resolveLink(cfg['chart-link-template'], m['chart-link'], m.symbol),
      },
    ]),
  );
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      showErrors={cfg['show-errors']}
      isLoading={loading}
    >
      <div className={styles.rows}>
        {markets.map((m) => (
          <Row key={m.symbol} market={m} {...(links.get(m.symbol) ?? {})} />
        ))}
      </div>
    </WidgetChrome>
  );
}

registerWidgetComponent('markets', Markets);

export default Markets;
