import type { SystemStatsConfig } from '../../../shared/widgets/system-stats';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { SystemStatsData } from '../../../shared/widgets/payloads';
import styles from './system-stats.module.css';

function fmtBytes(b: number): string {
  if (b >= 1e12) return `${(b / 1e12).toFixed(1)} TB`;
  if (b >= 1e9) return `${(b / 1e9).toFixed(1)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(0)} MB`;
  return `${b} B`;
}

function Row({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {sub ? <span className={styles.sub}>{sub}</span> : null}
    </div>
  );
}

export function SystemStats({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as SystemStatsConfig;
  const loading = isLoading === true;
  const d = data as SystemStatsData | null;

  if (loading) {
    return (
      <WidgetChrome
        title={cfg.title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        isLoading
        error={error}
      />
    );
  }

  // Graceful placeholder when not on homelab host (cpu null)
  if (!d || d.cpu === null) {
    return (
      <WidgetChrome
        title={cfg.title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        error={error}
      >
        <div className={styles.placeholder}>No data — not running on homelab host</div>
      </WidgetChrome>
    );
  }

  const rows: React.ReactNode[] = [];

  // CPU
  rows.push(
    <Row
      key="cpu"
      label="CPU"
      value={`${d.cpu.cores} cores${d.cpu.speed ? ` @ ${d.cpu.speed} GHz` : ''}`}
      sub={d.cpu.load != null ? `${Math.round(d.cpu.load)}%` : undefined}
    />,
  );

  // MEM
  if (d.mem) {
    const pct = d.mem.total ? Math.round((d.mem.used / d.mem.total) * 100) : 0;
    rows.push(
      <Row
        key="mem"
        label="MEM"
        value={`${fmtBytes(d.mem.used)} / ${fmtBytes(d.mem.total)}`}
        sub={`${pct}%`}
      />,
    );
  }

  // FS
  for (const f of d.fs) {
    rows.push(<Row key={`fs-${f.mount}`} label="DISK" value={`${f.mount} ${fmtBytes(f.used)} / ${fmtBytes(f.size)}`} sub={`${f.use}%`} />);
  }

  // TEMP
  if (d.temp != null) {
    rows.push(<Row key="temp" label="TEMP" value={`${d.temp}°C`} />);
  }

  // GPU
  for (const g of d.gpu) {
    rows.push(<Row key={`gpu-${g.model}`} label="GPU" value={g.model} sub={g.temp != null ? `${g.temp}°C` : undefined} />);
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

registerWidgetComponent('system-stats', SystemStats);

export default SystemStats;
