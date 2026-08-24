import type { TrendingData } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './github-trending.module.css';

function Trending({ config, data, error, isLoading }: WidgetComponentProps) {
  const d = data as TrendingData | null;
  const items = d ?? [];
  const loading = isLoading ?? (data == null && !error);
  if (error) return <WidgetChrome title={(config.title as string) ?? 'Trending'} error={String(error)} />;
  return (
    <WidgetChrome title={(config.title as string) ?? 'Trending'} isLoading={!!loading}>
      {items.length === 0 && !loading ? <div className={styles.empty}>No trending repos</div> : null}
      <ul className={styles.list}>
        {items.map((r) => (
          <li key={r.fullName} className={styles.row}>
            <a href={r.url} target="_blank" rel="noopener noreferrer" className={styles.name}>{r.fullName}</a>
            {r.description ? <div className={styles.desc}>{r.description}</div> : null}
            <div className={styles.meta}>
              {r.language ? <span className={styles.lang}>{r.language}</span> : null}
              <span>{r.stars.toLocaleString()} ★</span>
              {r.starsToday ? <span className={styles.today}>+{r.starsToday} today</span> : null}
            </div>
          </li>
        ))}
      </ul>
    </WidgetChrome>
  );
}

registerWidgetComponent('github-trending', Trending);
export default Trending;
