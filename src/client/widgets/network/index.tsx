import { useEffect, useState } from 'react';
import { Grid, Stack, Text } from '@astryxdesign/core';
import type { NetworkData } from '../../../shared/widgets/payloads';
import type { NetworkConfig } from '../../../shared/widgets/network';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './network.module.css';

function Network({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as NetworkConfig;
  const d = data as NetworkData | null;
  const [history, setHistory] = useState<number[]>([]);
  useEffect(() => {
    if (d?.pingMs != null) setHistory((h) => [...h.slice(-19), d.pingMs as number]);
  }, [d?.pingMs]);
  const loading = isLoading ?? (data == null && !error);
  if (error) return <WidgetChrome title={cfg.title ?? 'Network'} error={String(error)} showErrors={cfg['show-errors']} />;
  return (
    <WidgetChrome title={cfg.title ?? 'Network'} isLoading={!!loading}>
      <Grid columns={3} gap={2}>
        <Stack gap={0.5}>
          <Text type="label">Local</Text>
          <Text hasTabularNumbers>{d?.localIp ?? '—'}</Text>
        </Stack>
        <Stack gap={0.5}>
          <Text type="label">Public</Text>
          <Text hasTabularNumbers>{d?.publicIp ?? '—'}</Text>
        </Stack>
        <Stack gap={0.5}>
          <Text type="label">Ping</Text>
          <Text hasTabularNumbers>{d?.pingMs != null ? `${d.pingMs} ms` : '—'}</Text>
        </Stack>
      </Grid>
      {/* Data ink, not layout chrome: the inline heights ARE the series, so the
          bars stay hand-sized. One series means one hue — a sequential ramp
          would turn a single quantitative series into a rainbow. */}
      {history.length > 1 ? (
        <Stack direction="horizontal" gap={0.5} vAlign="end" height={24} className={styles.spark}>
          {history.map((v, i) => {
            const max = Math.max(...history, 1);
            const h = Math.round((v / max) * 20) + 2;
            return <span key={i} style={{ height: `${h}px` }} className={styles.bar} />;
          })}
        </Stack>
      ) : null}
    </WidgetChrome>
  );
}

registerWidgetComponent('network', Network);
export default Network;
