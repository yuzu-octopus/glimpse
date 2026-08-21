import { Text } from '@astryxdesign/core';
import { Server } from 'lucide-react';
import type { ServerStatsConfig } from '../../../shared/widgets/server-stats';
import type { ServerInfo, ServerStatsData } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useAge } from '../useAge';
import styles from './server-stats.module.css';

function fmtBytes(b: number): string {
  if (b >= 1e12) return `${(b / 1e12).toFixed(1)} TB`;
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
  return `${b} B`;
}

function pct(used: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
}

/** Stat bar with a --progress fill var; gray when the metric is unavailable. */
function Bar({ label, value, sub, available = true }: { label: string; value: string; sub?: string; available?: boolean }) {
  const p = available ? Math.min(100, Math.max(0, Number.parseInt(value, 10) || 0)) : 0;
  return (
    <div className={styles.stat} data-testid="server-stat">
      <div className={styles.statHead}>
        <span className={styles.statLabel}>{label}</span>
        <span className={`${styles.statValue} ${available ? '' : styles.statUnavailable}`}>
          {available ? value : 'n/a'}
          {sub ? <span className={styles.statSub}>{` ${sub}`}</span> : null}
        </span>
      </div>
      <meter
        className={`${styles.bar} ${available ? '' : styles.barUnavailable}`}
        style={{ '--progress': `${p}%` } as React.CSSProperties}
        min={0}
        max={100}
        value={available ? p : 0}
        aria-valuenow={available ? p : undefined}
        aria-label={label}
      />
    </div>
  );
}


function ServerCard({ server }: { server: ServerInfo }) {
  const age = useAge(server.bootTime || null);
  const memPct = server.memory.isAvailable ? pct(server.memory.used, server.memory.total) : 0;
  return (
    <section className={`${styles.server} ${server.isReachable ? '' : styles.serverDown}`} data-testid="server-card">
      <header className={styles.serverHeader}>
        <Server size={15} className={server.isReachable ? styles.serverIconUp : styles.serverIconDown} aria-hidden />
        <Text as="h3" size="lg" weight="semibold" display="block" className={styles.serverName}>
          {server.name}
        </Text>
        {server.hostname && server.hostname !== server.name ? <span className={styles.serverHost}>{server.hostname}</span> : null}
        {age ? <span className={styles.uptime}>{age}</span> : null}
      </header>

      {server.isReachable ? (
        <div className={styles.serverStats}>
          <Bar label="CPU" value={`${Math.round(server.cpu.load * 100)}`} available={server.cpu.loadIsAvailable} />
          {server.gpu?.map((g) => (
            <Bar key={g.model} label={`GPU ${g.model}`} value={g.temp != null ? `${Math.round(g.temp)}°C` : '—'} available={g.temp != null} />
          ))}
          <Bar label="RAM" value={`${memPct}%`} sub={server.memory.isAvailable ? `${fmtBytes(server.memory.used)} / ${fmtBytes(server.memory.total)}` : undefined} available={server.memory.isAvailable} />
          {server.mountpoints.map((m) => (
            <Bar key={m.path} label={`DISK ${m.path}`} value={`${pct(m.used, m.total)}%`} sub={fmtBytes(m.total)} />
          ))}
          {server.temp?.isAvailable ? <Bar label="TEMP" value={`${Math.round(server.temp.main!)}°C`} /> : null}
        </div>
      ) : (
        <p className={styles.unreachable}>Unreachable</p>
      )}
    </section>
  );
}

function ServerStats({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as ServerStatsConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const servers = ((data as ServerStatsData | null)?.servers ?? []) as ServerInfo[];
  return (
    <WidgetChrome
      title={cfg.title ?? 'Servers'}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      isLoading={loading}
    >
      {servers.map((s) => (
        <ServerCard key={`${s.name}-${s.hostname}`} server={s} />
      ))}
    </WidgetChrome>
  );
}
registerWidgetComponent('server-stats', ServerStats);

export default ServerStats;
