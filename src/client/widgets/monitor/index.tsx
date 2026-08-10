import { monitorSchema } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { MonitorSite } from '../../../server/widgets/monitor';
import styles from './monitor.module.css';

function SiteRow({ site }: { site: MonitorSite }) {
  return (
    <div className={styles.row}>
      <span className={`${styles.dot} ${site.ok ? styles.dotUp : styles.dotDown}`} aria-label={site.ok ? 'up' : 'down'} />
      <div className={styles.rowBody}>
        <span className={styles.title}>{site.title || site.url}</span>
        <span className={styles.url}>{site.url}</span>
      </div>
      <span className={styles.ms}>{site.ms !== null ? `${site.ms} ms` : '—'}</span>
    </div>
  );
}

function Monitor({ config, data }: WidgetComponentProps) {
  const cfg = monitorSchema.parse(config);
  const sites = ((data as { sites?: MonitorSite[] } | null)?.sites ?? []) as MonitorSite[];
  const visible = cfg['show-failing-only'] ? sites.filter((s) => !s.ok) : sites;
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={[cfg['css-class'], cfg.style === 'compact' ? styles.compact : undefined].filter(Boolean).join(' ') || undefined}
      items={visible.map((s) => <SiteRow key={s.url} site={s} />)}
    />
  );
}

registerWidgetComponent('monitor', Monitor);

export default Monitor;
