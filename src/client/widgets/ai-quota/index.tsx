import { useEffect, useState } from 'react';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { AiQuotaData } from '../../../shared/widgets/payloads';
import styles from './ai-quota.module.css';

function fmtReset(ms: number): string {
  const s = Math.max(0, Math.floor((ms - Date.now()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function AiQuota({ config, data, error, isLoading }: WidgetComponentProps) {
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!data) return;
    const id = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(id);
  }, [data]);
  void tick;
  if (loading) return <WidgetChrome title={(config as Record<string, string>).title} isLoading />;
  if (error) return <WidgetChrome title={(config as Record<string, string>).title} error={error} />;
  const d = data as AiQuotaData;
  return (
    <WidgetChrome
      title={(config as Record<string, string>).title ?? `${d.provider} quota`}
      hideHeader={(config as Record<string, boolean>)['hide-header']}
    >
      {d.plan ? <span className={styles.plan}>{d.plan}</span> : null}
      {d.windows.map((w) => {
        const pct = Math.min(100, w.usedPercent);
        const fillClass =
          pct > 90 ? `${styles.fill} ${styles.fillNegative}` : pct >= 70 ? `${styles.fill} ${styles.fillWarning}` : styles.fill;
        return (
          <div key={w.label} className={styles.row}>
            <div className={styles.label}>
              {w.label} — {Math.round(w.usedPercent)}% · resets in {fmtReset(w.resetsAt)}
            </div>
            <div className={styles.bar}>
              <div className={fillClass} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
      {d.balance !== undefined ? <div className={styles.balance}>Balance: {d.balance}</div> : null}
    </WidgetChrome>
  );
}

registerWidgetComponent('ai-quota', AiQuota);

export default AiQuota;
