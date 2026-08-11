import { Link } from '@astryxdesign/core';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { marketsSchema } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { Market } from '../../../server/widgets/markets';
import styles from './markets.module.css';

/** 21-point sparkline, hand-rolled inline SVG (glance parity — a chart, not an icon). */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${50 - ((v - min) / range) * 40}`)
    .join(' ');
  return (
    <svg viewBox="0 0 100 50" className={styles.sparkline} aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-text-subdue)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Change({ change, changePct }: { change: number | null; changePct: number | null }) {
  if (change === null) return null;
  // glance colors strictly by sign; zero stays neutral
  const up = change > 0;
  const down = change < 0;
  const cls = up ? styles.up : down ? styles.down : undefined;
  return (
    <span className={cls ? `${styles.change} ${cls}` : styles.change}>
      {up ? <ArrowUp size={12} /> : down ? <ArrowDown size={12} /> : null}
      {change.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      {changePct !== null ? ` (${changePct.toFixed(2)}%)` : ''}
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
  const sparkline = <Sparkline values={market.chart} />;
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
          {market.price !== null ? market.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
        </span>
      </div>
    </div>
  );
}

function Markets({ config, data }: WidgetComponentProps) {
  const cfg = marketsSchema.parse(config);
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
      items={markets.map((m) => (
        <Row key={m.symbol} market={m} {...(links.get(m.symbol) ?? {})} />
      ))}
    />
  );
}

registerWidgetComponent('markets', Markets);

export default Markets;
