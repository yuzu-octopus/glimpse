import { Text } from '@astryxdesign/core';
import { Cpu, HardDrive, MemoryStick, Monitor, Server, Thermometer } from 'lucide-react';
import type { ServerStatsConfig } from '../../../shared/widgets/server-stats';
import type { ServerInfo, ServerStatsData } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useAge } from '../_hooks/useAge';
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
function Bar({ label, value, sub, available = true }: { label?: string; value: string; sub?: string; available?: boolean }) {
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
  // collapsed DISK: max of "/" and "/System/Volumes/Data" (they share 494.3 GB, pick the fuller)
  const disk = (() => {
    if (!server.mountpoints.length) return null;
    let best = server.mountpoints[0];
    for (const m of server.mountpoints) if (pct(m.used, m.total) > pct(best.used, best.total)) best = m;
    return best;
  })();
  const diskPct = disk ? pct(disk.used, disk.total) : 0;
  const gpu = server.gpu?.[0] ?? null;
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
        <div className={styles.bento}>
          <div className={styles.cell}>
            <Cpu size={14} className={styles.cellIcon} aria-hidden />
            <div className={styles.cellBody}>
              <div className={styles.cellLabel}>CPU</div>
              <Bar label="CPU" value={`${Math.round(server.cpu.load * 100)}`} available={server.cpu.loadIsAvailable} />
            </div>
          </div>
          <div className={styles.cell}>
            <Monitor size={14} className={styles.cellIcon} aria-hidden />
            <div className={styles.cellBody}>
              <div className={styles.cellLabel}>GPU</div>
              <Bar label="GPU" value={gpu?.temp != null ? `${Math.round(gpu.temp)}°C` : '—'} available={gpu?.temp != null} />
            </div>
          </div>
          <div className={styles.cell}>
            <MemoryStick size={14} className={styles.cellIcon} aria-hidden />
            <div className={styles.cellBody}>
              <div className={styles.cellLabel}>RAM</div>
              <Bar label="RAM" value={`${memPct}%`} sub={server.memory.isAvailable ? `${fmtBytes(server.memory.used)} / ${fmtBytes(server.memory.total)}` : undefined} available={server.memory.isAvailable} />
            </div>
          </div>
          <div className={styles.cell}>
            <HardDrive size={14} className={styles.cellIcon} aria-hidden />
            <div className={styles.cellBody}>
              <div className={styles.cellLabel}>DISK</div>
              {disk ? <Bar label={`DISK ${disk.path}`} value={`${diskPct}%`} sub={fmtBytes(disk.total)} /> : <Bar label="DISK" value="—" available={false} />}
            </div>
          </div>
          {server.temp?.isAvailable ? (
            <div className={`${styles.cell} ${styles.tempCell}`}>
              <Thermometer size={14} className={styles.cellIcon} aria-hidden />
              <div className={styles.cellBody}>
                <div className={styles.cellLabel}>TEMP</div>
                <div className={styles.tempValue}>{Math.round(server.temp.main!)}°C</div>
              </div>
            </div>
          ) : null}
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
