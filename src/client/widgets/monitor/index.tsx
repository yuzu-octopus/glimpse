import { Link, Stack, StatusDot, Text } from '@astryxdesign/core';
import { MONITOR_DEFAULTS, type MonitorConfig } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { MonitorSite } from '../../../shared/widgets/payloads';
import styles from './monitor.module.css';
void MONITOR_DEFAULTS;

function SiteRow({ site }: { site: MonitorSite }) {
  // Down + error-url configured -> error-url is the link; same-tab controls target (default new tab).
  const href = site.ok || !site.errorUrl ? site.url : site.errorUrl;
  const target = site.sameTab ? undefined : '_blank';
  return (
    <Stack direction="horizontal" gap={3} vAlign="center" className={styles.row}>
      {/* Status goes to StatusDot: the kit owns the 8px mark, the accessible
          name and the positive/negative vocabulary. */}
      <StatusDot variant={site.ok ? 'success' : 'error'} label={site.ok ? 'up' : 'down'} />
      <Stack direction="horizontal" gap={2} className={styles.rowBody}>
        <Link
          href={href}
          target={target}
          hasUnderline={false}
          className={styles.title}
          maxLines={1}
        >
          {site.title || site.url}
        </Link>
        <Text type="supporting" maxLines={1} className={styles.url}>
          {site.url}
        </Text>
      </Stack>
      <Text type="supporting" hasTabularNumbers className={styles.ms}>
        {site.ms !== null ? `${site.ms} ms` : '—'}
      </Text>
    </Stack>
  );
}

function Monitor({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as MonitorConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const sites = ((data as { sites?: MonitorSite[] } | null)?.sites ?? []) as MonitorSite[];
  const visible = cfg['show-failing-only'] ? sites.filter((s) => !s.ok) : sites;
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={[cfg['css-class'], cfg.style === 'compact' ? styles.compact : undefined].filter(Boolean).join(' ') || undefined}
      error={error}
      showErrors={cfg['show-errors']}
      isLoading={loading}
      items={visible.map((s) => <SiteRow key={s.url} site={s} />)}
    />
  );
}

registerWidgetComponent('monitor', Monitor);

export default Monitor;
