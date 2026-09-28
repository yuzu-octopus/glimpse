import type { TrendingData } from '../../../shared/widgets/payloads';
import type { GithubTrendingConfig } from '../../../shared/widgets/github-trending';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { Link, Text } from '@astryxdesign/core';
import styles from './github-trending.module.css';

function Trending({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as GithubTrendingConfig;
  const d = data as TrendingData | null;
  const items = d ?? [];
  const loading = isLoading ?? (data == null && !error);
  if (error) {
    return (
      <WidgetChrome
        title={cfg.title ?? 'Trending'}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        error={String(error)}
        showErrors={cfg['show-errors']}
      />
    );
  }
  return (
    <WidgetChrome
      title={cfg.title ?? 'Trending'}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      isLoading={!!loading}
    >
      {items.length === 0 && !loading ? <div className={styles.empty}>No trending repos</div> : null}
      <ul className={styles.list}>
        {items.map((r) => (
          <li key={r.fullName} className={styles.row}>
            <Link href={r.url} target="_blank" weight="semibold" hasUnderline={false}>
              {r.fullName}
            </Link>
            {r.description ? <Text as="div" type="body" color="secondary" maxLines={2}>{r.description}</Text> : null}
            <div className={styles.meta}>
              {r.language ? <span className={styles.lang}>{r.language}</span> : null}
              {/* `stars` is scraped, not validated: a GitHub markup change
                  that leaves the count unreadable must cost the count, not
                  the card. `starsToday` and `language` were already guarded
                  and this was the one numeric access that was not. */}
              {typeof r.stars === 'number' && !Number.isNaN(r.stars) ? (
                <span>{r.stars.toLocaleString()} ★</span>
              ) : null}
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
