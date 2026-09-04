import type { ChangeDetectionConfig } from '../../../shared/widgets/change-detection';
import type { ChangeDetectionData } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
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
    return <WidgetChrome title={cfg.title ?? 'Changes'} error={String(error)} />;
  }
  return (
    <WidgetChrome title={cfg.title ?? 'Changes'} isLoading={!!loading}>
      {items.length === 0 && !loading ? <div className={styles.empty}>No watched URLs</div> : null}
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item.url} className={styles.row}>
            <div className={styles.top}>
              <a href={item.url} target="_blank" rel="noopener noreferrer" className={styles.name}>
                {hostOf(item.url)}
              </a>
              {item.changed ? <span className={styles.badge}>Changed</span> : null}
            </div>
            {item.changedAt ? (
              <div className={styles.meta}>changed {TIME_FMT.format(new Date(item.changedAt))}</div>
            ) : (
              <div className={styles.meta}>unchanged</div>
            )}
            {item.diffSnippet ? <div className={styles.snippet}>{item.diffSnippet}</div> : null}
          </li>
        ))}
      </ul>
    </WidgetChrome>
  );
}

registerWidgetComponent('change-detection', ChangeDetection);
export default ChangeDetection;
