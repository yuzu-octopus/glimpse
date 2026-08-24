import type { ContributionGraphConfig } from '../../../shared/widgets/contribution';
import type { ContributionDay, ContributionGraphData } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './contribution-graph.module.css';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Month label above each week column whose first day starts a new month. */
function monthLabels(days: ContributionDay[]): Array<{ col: number; label: string }> {
  const labels: Array<{ col: number; label: string }> = [];
  let lastMonth = -1;
  for (let i = 0; i < days.length; i += 7) {
    const month = Number(days[i].date.slice(5, 7)) - 1;
    if (month !== lastMonth) {
      labels.push({ col: i / 7, label: MONTHS[month] });
      lastMonth = month;
    }
  }
  return labels;
}

function ContributionGraph({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as ContributionGraphConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const payload = (data ?? {}) as Partial<ContributionGraphData>;
  const days = payload.days ?? [];
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const weeks = Math.ceil(days.length / 7) || 1;
  const labels = monthLabels(days);

  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      isLoading={loading}
      items={[
        <div key="graph" className={styles.wrap}>
          {days.length > 0 ? (
            <>
              <div className={styles.summary}>
                {total} contribution{total === 1 ? '' : 's'}
              </div>
              <div className={styles.grid} style={{ ['--weeks' as string]: String(weeks) }}>
                {labels.map((l) => (
                  <span key={`${l.label}-${l.col}`} className={styles.month} style={{ gridColumnStart: l.col + 1 }}>
                    {l.label}
                  </span>
                ))}
              </div>
              <div
                className={styles.grid}
                data-testid="contribution-grid"
                style={{ ['--weeks' as string]: String(weeks) }}
              >
                {days.map((d) => (
                  <div
                    key={d.date}
                    className={`${styles.cell} ${styles[`l${d.level}`]}`}
                    data-testid={`cell-${d.date}`}
                    data-level={d.level}
                    title={`${d.count} contribution${d.count === 1 ? '' : 's'} on ${d.date}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>,
      ]}
    />
  );
}

registerWidgetComponent('contribution-graph', ContributionGraph);

export default ContributionGraph;
