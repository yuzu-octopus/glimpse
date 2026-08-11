import { Link } from '@astryxdesign/core';
import type { CustomApiConfig } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { CustomApiItem } from '../../../server/widgets/custom-api';
import styles from './custom-api.module.css';

function ItemRow({ item }: { item: CustomApiItem }) {
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
        {title}
        {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
      </div>
      <div className={styles.rowRight}>
        {item.value ? <span className={styles.value}>{item.value}</span> : null}
        {item.timestamp ? <span className={styles.timestamp}>{item.timestamp}</span> : null}
      </div>
    </div>
  );
}

function CustomApi({ config, data, error }: WidgetComponentProps) {
  const cfg = config as unknown as CustomApiConfig;
  const items = ((data as { items?: CustomApiItem[] } | null)?.items ?? []) as CustomApiItem[];
  const frameless = cfg.frameless === true;

  const rows = items.map((item) => <ItemRow key={item.title + (item.url ?? '')} item={item} />);
  if (frameless) {
    // frameless has no chrome to hang the error on — surface it inline
    return (
      <div className={styles.frameless} data-testid="custom-api-frameless">
        {error ? <div className={styles.framelessError}>{error}</div> : rows}
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
      items={rows}
    />
  );
}

registerWidgetComponent('custom-api', CustomApi);

export default CustomApi;
