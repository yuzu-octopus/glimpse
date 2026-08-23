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

function Row({
  icon: Icon,
  label,
  detail,
  temp,
  percent,
  value,
  available = true,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  detail?: string | null;
  temp?: number | null;
  percent: number;
  value: string;
  available?: boolean;
}) {
  const p = available ? Math.max(0, Math.min(100, percent)) : 0;
  return (
    <div className={styles.row} data-testid="server-row">
      <div className={styles.rowHead}>
        <Icon size={14} className={styles.rowIcon} aria-hidden />
        <Text as="span" size="sm" weight="semibold" className={styles.rowLabel}>
          {label}
        </Text>
        {detail ? (
          <span className={styles.rowDetail} title={detail}>
            · {detail}
          </span>
        ) : null}
        {temp != null ? (
          <span className={styles.rowTemp} title={`${Math.round(temp)}°C`}>
            <Thermometer size={12} aria-hidden /> {Math.round(temp)}°
          </span>
        ) : null}
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
      <Text as="div" size="sm" className={`${styles.rowValue} ${available ? '' : styles.statUnavailable}`}>
        {available ? value : 'n/a'}
      </Text>
    </div>
  );
}

function ServerCard({ server }: { server: ServerInfo }) {
  const age = useAge(server.bootTime || null);
  const memPct = server.memory.isAvailable ? pct(server.memory.used, server.memory.total) : 0;
  const disk = server.mountpoints[0] ?? null;
  const diskPct = disk ? pct(disk.used, disk.total) : 0;
  const gpu = server.gpu?.[0] ?? null;
  return (
    <section className={`${styles.server} ${server.isReachable ? '' : styles.serverDown}`} data-testid="server-card">
      <header className={styles.serverHeader}>
        <Server size={15} className={server.isReachable ? styles.serverIconUp : styles.serverIconDown} aria-hidden />
        <Text as="h3" size="lg" weight="semibold" className={styles.serverName}>
          <span title={server.hostname || server.name}>{server.hostname || server.name}</span>
        </Text>
        {age ? <span className={styles.uptime}>{age}</span> : null}
      </header>
      {server.isReachable ? (
        <div style={{ display: 'grid', gap: '10px' }}>
          <Row
            icon={Cpu}
            label="CPU"
            detail={server.cpu.name ?? null}
            temp={null}
            percent={Math.round(server.cpu.load * 100)}
            value={`${Math.round(server.cpu.load * 100)}%`}
            available={server.cpu.loadIsAvailable}
          />
          <Row
            icon={Monitor}
            label="GPU"
            detail={gpu?.model ?? null}
            temp={gpu?.temp ?? null}
            percent={gpu?.temp != null ? Math.min(100, Math.round(gpu.temp)) : 0}
            value={gpu?.temp != null ? `${Math.round(gpu.temp)}°C` : gpu?.model ? '—' : 'n/a'}
            available={!!gpu}
          />
          <Row
            icon={MemoryStick}
            label="RAM"
            percent={memPct}
            value={server.memory.isAvailable ? `${fmtBytes(server.memory.used)} / ${fmtBytes(server.memory.total)}` : 'n/a'}
            available={server.memory.isAvailable}
          />
          <Row
            icon={HardDrive}
            label="DISK"
            percent={diskPct}
            value={disk ? `${fmtBytes(disk.used)} / ${fmtBytes(disk.total)}` : 'n/a'}
            available={!!disk}
          />
          {server.temp?.isAvailable ? (
            <Row
              icon={Thermometer}
              label="TEMP"
              percent={Math.min(100, Math.round(server.temp.main!))}
              value={`${Math.round(server.temp.main!)}°C`}
              available={true}
            />
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
      title={cfg.title ?? (servers[0]?.hostname || servers[0]?.name || 'Homelab')}
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
