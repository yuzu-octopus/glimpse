import type { DnsStatsConfig } from '../../../shared/widgets/dns';
import type { DnsStats } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './dns.module.css';

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function fmtApprox(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function DnsStatsWidget({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as DnsStatsConfig;
  const d = data as DnsStats | null;
  const loading = isLoading ?? ((data as unknown) == null && !error);

  if (loading) {
    return (
      <WidgetChrome
        title={cfg.title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        isLoading
      />
    );
  }

  if (error) {
    return (
      <WidgetChrome
        title={cfg.title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        error={error}
      />
    );
  }

  if (!d) {
    return (
      <WidgetChrome
        title={cfg.title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
      >
        <div style={{ fontSize: 12, color: 'var(--color-text-subdue)', padding: '8px 0' }}>No data</div>
      </WidgetChrome>
    );
  }

  const showGraph = !cfg['hide-graph'] && d.series.length > 0;
  const showTop = !cfg['hide-top-domains'] && d.topBlockedDomains.length > 0;

  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
    >
      <div className={styles.dns} data-testid="dns-root">
        <div className={styles.totals}>
          <div className={styles.totalsItem}>
            <div className={styles.totalsValue} data-testid="dns-total">
              {fmt(d.totalQueries)}
            </div>
            <div className={styles.totalsLabel}>QUERIES</div>
          </div>
          <div className={styles.totalsItem}>
            <div className={styles.totalsValue} data-testid="dns-blocked">
              {d.blockedPercent}%
            </div>
            <div className={styles.totalsLabel}>BLOCKED</div>
          </div>
          {d.responseTime > 0 ? (
            <div className={styles.totalsItem}>
              <div className={styles.totalsValue} data-testid="dns-latency">
                {fmt(d.responseTime)}ms
              </div>
              <div className={styles.totalsLabel}>LATENCY</div>
            </div>
          ) : (
            <div className={styles.totalsItem} title="Total number of blocked domains from all adlists">
              <div className={styles.totalsValue} data-testid="dns-domains">
                {fmtApprox(d.domainsBlocked)}
              </div>
              <div className={styles.totalsLabel}>DOMAINS</div>
            </div>
          )}
        </div>

        {showGraph ? (
          <div className={styles.graph} data-testid="dns-graph">
            <div className={styles.gridlinesContainer} aria-hidden>
              <svg
                className={styles.gridlines}
                shapeRendering="crispEdges"
                viewBox="0 0 1 100"
                preserveAspectRatio="none"
              >
                <g stroke="var(--color-graph-gridlines)" strokeWidth="1">
                  <line x1="0" y1="1" x2="1" y2="1" vectorEffect="non-scaling-stroke" />
                  <line x1="0" y1="25" x2="1" y2="25" vectorEffect="non-scaling-stroke" />
                  <line x1="0" y1="50" x2="1" y2="50" vectorEffect="non-scaling-stroke" />
                  <line x1="0" y1="75" x2="1" y2="75" vectorEffect="non-scaling-stroke" />
                  <line x1="0" y1="99" x2="1" y2="99" vectorEffect="non-scaling-stroke" stroke="var(--color-progress-border)" />
                </g>
              </svg>
            </div>
            <div className={styles.columns}>
              {d.series.map((pt, i) => (
                <div key={i} className={styles.column} data-testid="dns-column">
                  <div className={styles.tip} data-testid="dns-tip">
                    <div>
                      <div className={styles.tipValue}>{fmt(pt.queries)}</div>
                      <div className={styles.tipLabel}>QUERIES</div>
                    </div>
                    <div>
                      <div className={styles.tipValue}>{pt.percentBlocked}%</div>
                      <div className={styles.tipLabel}>BLOCKED</div>
                    </div>
                  </div>
                  {pt.percentTotal > 0 ? (
                    <div
                      className={styles.bar}
                      style={{ '--bar-height': String(pt.percentTotal) } as React.CSSProperties}
                      data-testid="dns-bar"
                    >
                      {pt.queries !== pt.blocked ? <div className={styles.queries} /> : null}
                      {pt.percentBlocked > 0 ? (
                        <div className={styles.blocked} style={{ '--percent': `${pt.percentBlocked}%` } as React.CSSProperties} />
                      ) : null}
                    </div>
                  ) : null}
                  <div className={styles.time} data-testid="dns-time">
                    {d.timeLabels[i] ?? ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {showTop ? (
          <details className={`${styles.details} ${showGraph ? styles.detailsWithGraph : ''}`} data-testid="dns-details">
            <summary className={styles.summary}>Top blocked domains</summary>
            <ul className={styles.list}>
              {d.topBlockedDomains.map((t) => (
                <li key={t.domain} className={styles.row} data-testid="dns-domain-row">
                  <div className={styles.domain} title={t.domain}>
                    {t.domain}
                  </div>
                  <div className={styles.percent}>
                    <span className={styles.percentValue}>{t.percentBlocked}</span>%
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </WidgetChrome>
  );
}

registerWidgetComponent('dns-stats', DnsStatsWidget);
export default DnsStatsWidget;
