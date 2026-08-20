import { Star } from 'lucide-react';
import { Link } from '@astryxdesign/core';
import type { CustomApiConfig } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { CustomApiItem } from '../../../shared/widgets/payloads';
import styles from './custom-api.module.css';

function ItemRow({ item }: { item: CustomApiItem }) {
  const showStar = /star/i.test(item.title);
  const title = item.url ? (
    <Link href={item.url} target="_blank" className={styles.title} hasUnderline={false}>
      {item.title}
    </Link>
  ) : (
    <span className={styles.title}>{item.title}</span>
  );
  const subtitle = item.subtitle ?? item.description;
  return (
    <div className={styles.row}>
      {item.image ? (
        <img src={item.image} alt="" loading="lazy" className={styles.image} />
      ) : item.icon ? (
        <img src={item.icon} alt="" loading="lazy" className={styles.icon} />
      ) : null}
      <div className={styles.rowBody}>
        <div className={styles.titleRow}>
          {showStar ? <Star size={14} data-testid="custom-api-star" className={styles.starIcon} /> : null}
          {title}
        </div>
        {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
      </div>
      <div className={styles.rowRight}>
        {item.value ? <span className={styles.value}>{item.value}</span> : null}
        {item.timestamp ? <span className={styles.timestamp}>{item.timestamp}</span> : null}
      </div>
    </div>
  );
}

function CustomApi({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as CustomApiConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const items = ((data as { items?: CustomApiItem[] } | null)?.items ?? []) as CustomApiItem[];
  const frameless = cfg.frameless === true;
  const collapseAfter = cfg['collapse-after'];

  const rows = items.map((item) => <ItemRow key={item.title + (item.url ?? '')} item={item} />);
  if (frameless) {
    // frameless has no chrome to hang error/loading on — surface inline but still respect collapseAfter
    if (loading) {
      return (
        <div className={styles.frameless} data-testid="custom-api-frameless">
          <div data-testid="widget-loading">Loading…</div>
        </div>
      );
    }
    if (error) {
      return (
        <div className={styles.frameless} data-testid="custom-api-frameless">
          <div className={styles.framelessError}>{error}</div>
        </div>
      );
    }
    // Reuse WidgetChrome collapse UI for consistency when collapseAfter is set; otherwise plain group
    if (typeof collapseAfter === 'number' && collapseAfter >= 0 && rows.length > collapseAfter) {
      return (
        <div className={styles.frameless} data-testid="custom-api-frameless">
          <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']} collapseAfter={collapseAfter} items={rows} />
        </div>
      );
    }
    return (
      <div className={styles.frameless} data-testid="custom-api-frameless">
        {rows}
      </div>
    );
  }
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      isLoading={loading}
      collapseAfter={collapseAfter}
      items={rows}
    />
  );
}

registerWidgetComponent('custom-api', CustomApi);

export default CustomApi;
