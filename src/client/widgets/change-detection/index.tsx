import type { ChangeDetectionConfig } from '../../../shared/widgets/change-detection';
import type { ChangeDetectionData } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { Link, Text } from '@astryxdesign/core';
import styles from './change-detection.module.css';

const TIME_FMT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function ChangeDetection({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as ChangeDetectionConfig;
  const items = (data as ChangeDetectionData | null) ?? [];
  const loading = isLoading ?? ((data as unknown) == null && !error);
  if (error) {
    return (
      <WidgetChrome
        title={cfg.title ?? 'Changes'}
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
      title={cfg.title ?? 'Changes'}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      isLoading={!!loading}
    >
      {items.length === 0 && !loading ? <div className={styles.empty}>No watched URLs</div> : null}
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.url} className={styles.row}>
            <div className={styles.top}>
              <Link href={item.url} target="_blank" weight="semibold" hasUnderline={false} maxLines={1}>
                {hostOf(item.url)}
              </Link>
              {item.changed ? <span className={styles.badge}>Changed</span> : null}
            </div>
            {item.changedAt ? (
              <div className={styles.meta}>changed {TIME_FMT.format(new Date(item.changedAt))}</div>
            ) : (
              <div className={styles.meta}>unchanged</div>
            )}
            {item.diffSnippet ? <Text as="div" type="body" color="secondary" maxLines={2}>{item.diffSnippet}</Text> : null}
          </li>
        ))}
      </ul>
    </WidgetChrome>
  );
}

registerWidgetComponent('change-detection', ChangeDetection);
export default ChangeDetection;
