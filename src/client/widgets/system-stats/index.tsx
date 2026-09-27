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

/** `percent` is the row's 0-100 load. A row without one (a GPU model with no
 *  temperature) gets no bar — a fabricated series would read as data. */
function Row({
  label,
  value,
  sub,
  percent,
}: {
  label: string;
  value: string;
  sub?: string;
  percent?: number | null;
}) {
  const p = percent == null ? null : Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      {sub ? <span className={styles.sub}>{sub}</span> : null}
      {p === null ? null : (
        <meter
          className={styles.meter}
          data-high={p >= 85 || undefined}
          data-critical={p >= 95 || undefined}
          style={{ '--progress': `${p}%` } as React.CSSProperties}
          min={0}
          max={100}
          value={p}
          aria-valuenow={p}
          aria-label={`${label} load`}
        />
      )}
    </div>
  );
}

export function SystemStats({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as SystemStatsConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
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
        showErrors={cfg['show-errors']}
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
        showErrors={cfg['show-errors']}
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
      percent={d.cpu.load}
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
        percent={pct}
      />,
    );
  }

  // FS
  for (const f of d.fs) {
    rows.push(<Row key={`fs-${f.mount}`} label="DISK" value={`${f.mount} ${fmtBytes(f.used)} / ${fmtBytes(f.size)}`} sub={`${f.use}%`} percent={f.use} />);
  }

  // TEMP
  if (d.temp != null) {
    rows.push(<Row key="temp" label="TEMP" value={`${d.temp}°C`} percent={d.temp} />);
  }

  // GPU
  for (const g of d.gpu) {
    rows.push(<Row key={`gpu-${g.model}-${g.temp ?? 'na'}`} label="GPU" value={g.model} sub={g.temp != null ? `${g.temp}°C` : undefined} percent={g.temp} />);
  }

  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      showErrors={cfg['show-errors']}
      items={rows}
    />
  );
}

registerWidgetComponent('system-stats', SystemStats);

export default SystemStats;
