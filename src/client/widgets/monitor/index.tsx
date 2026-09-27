import { useState } from 'react';
import { Link, Stack, StatusDot, Text } from '@astryxdesign/core';
import { MONITOR_DEFAULTS, type MonitorConfig } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
// One customIconField port for the whole app: the same `icon:` string has the
// same meaning in bookmarks and in a monitor site, so it is resolved once.
import { resolveIcon } from '../../../shared/widgets/icon';
import type { MonitorSite } from '../../../shared/widgets/payloads';
import styles from './monitor.module.css';
void MONITOR_DEFAULTS;

/** glance widget-monitor.go renders .Icon.URL, and skips the img entirely when
 * there is none. A bad URL must cost the icon, not the row. */
function SiteIcon({ icon }: { icon: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const { src, autoInvert } = resolveIcon(icon);
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={autoInvert ? `${styles.icon} ${styles.iconAutoInvert}` : styles.icon}
    />
  );
}

function SiteRow({ site, icon }: { site: MonitorSite; icon?: string }) {
  // Down + error-url configured -> error-url is the link; same-tab controls target (default new tab).
  const href = site.ok || !site.errorUrl ? site.url : site.errorUrl;
  const target = site.sameTab ? undefined : '_blank';
  return (
    <Stack direction="horizontal" gap={3} vAlign="center" className={styles.row}>
      {/* Status goes to StatusDot: the kit owns the 8px mark, the accessible
          name and the positive/negative vocabulary. */}
      <StatusDot variant={site.ok ? 'success' : 'error'} label={site.ok ? 'up' : 'down'} />
      {icon ? <SiteIcon icon={icon} /> : null}
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
      {/* The HTTP status the check came back with: fetched for every site and
          never shown, while glance lists it beside the latency. The dot
          already carries pass/fail, so this stays neutral — it tells you
          *which* code, not how to feel about it. */}
      {site.status != null ? (
        <Text type="supporting" hasTabularNumbers className={styles.status}>
          {site.status}
        </Text>
      ) : null}
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
  // `icon:` is static config, so it never travels through the fetch payload —
  // the row just looks its own entry up. Sites pulled from kuma/healthchecks
  // have no entry here and correctly render no icon.
  const icons: Record<string, string | undefined> = Object.fromEntries(
    (cfg.sites ?? []).map((s) => [s.url, s.icon]),
  );
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={[cfg['css-class'], cfg.style === 'compact' ? styles.compact : undefined].filter(Boolean).join(' ') || undefined}
      error={error}
      showErrors={cfg['show-errors']}
      isLoading={loading}
    >
      {/* `show-failing-only` with every site healthy filtered all of them out,
          and unlike dns/system-stats/weather this had no empty branch — the
          card body came back as a bare empty rail with nothing to say why.
          The two empties are not the same news: an empty config has nothing
          to check, while an all-clear is the answer the filter was asked for. */}
      {visible.length === 0 && !loading ? (
        <div className={styles.empty}>
          {sites.length === 0 ? 'No sites to monitor.' : 'All sites up.'}
        </div>
      ) : null}
      {visible.map((s) => (
        <SiteRow key={s.url} site={s} icon={icons[s.url]} />
      ))}
    </WidgetChrome>
  );
}

registerWidgetComponent('monitor', Monitor);

export default Monitor;
