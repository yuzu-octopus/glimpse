import { useEffect, useState } from 'react';
import type { NetworkData } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './network.module.css';

function Network({ config, data, error, isLoading }: WidgetComponentProps) {
  const d = data as NetworkData | null;
  const [history, setHistory] = useState<number[]>([]);
  useEffect(() => {
    if (d?.pingMs != null) setHistory((h) => [...h.slice(-19), d.pingMs as number]);
  }, [d?.pingMs]);
  const loading = isLoading ?? (data == null && !error);
  if (error) return <WidgetChrome title={(config.title as string) ?? 'Network'} error={String(error)} />;
  return (
    <WidgetChrome title={(config.title as string) ?? 'Network'} isLoading={!!loading}>
      <div className={styles.grid}>
        <div><span className={styles.label}>Local</span><span className={styles.val}>{d?.localIp ?? '—'}</span></div>
        <div><span className={styles.label}>Public</span><span className={styles.val}>{d?.publicIp ?? '—'}</span></div>
        <div><span className={styles.label}>Ping</span><span className={styles.val}>{d?.pingMs != null ? `${d.pingMs} ms` : '—'}</span></div>
      </div>
      {history.length > 1 ? (
        <div className={styles.spark}>
          {history.map((v, i) => {
            const max = Math.max(...history, 1);
            const h = Math.round((v / max) * 20) + 2;
            return <span key={i} style={{ height: `${h}px` }} className={styles.bar} />;
          })}
        </div>
      ) : null}
    </WidgetChrome>
  );
}

registerWidgetComponent('network', Network);
export default Network;
