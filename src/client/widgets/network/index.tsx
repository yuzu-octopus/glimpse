import { useEffect, useRef, useState } from 'react';
import { Grid, Stack, Text } from '@astryxdesign/core';
import type { NetworkData } from '../../../shared/widgets/payloads';
import { NETWORK_DEFAULTS, type NetworkConfig } from '../../../shared/widgets/network';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './network.module.css';

/** 20 bars at one sample per 30s is a 10-minute window. */
const SAMPLES = 20;
const SAMPLE_MS = 30_000;

function Network({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as NetworkConfig;
  const d = data as NetworkData | null;
  const [history, setHistory] = useState<number[]>([]);
  const latest = useRef<number | null>(null);
  useEffect(() => {
    // A failed ping is not a reading: it clears the last one so the sampler
    // holds the window it has instead of repeating a stale value as if it
    // were fresh.
    latest.current = d?.pingMs ?? null;
  }, [d?.pingMs]);
  // The series is a time series, not an arrival log: it samples on its own
  // tick and records whatever the last reading was. Keying it on the ping
  // value — the obvious version — appends nothing while the link is steady,
  // which on a LAN it always is, so the sparkline never draws at all. A flat
  // line is what steady looks like. The target is the series' identity: a
  // page can swap one network card for another in the same slot, and that
  // card's history is not this one's.
  const series = String(cfg['ping-target'] ?? NETWORK_DEFAULTS.pingTarget);
  useEffect(() => {
    setHistory([]);
    const id = setInterval(() => {
      const ping = latest.current;
      if (ping == null) return;
      setHistory((h) => [...h.slice(-(SAMPLES - 1)), ping]);
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, [series]);
  const loading = isLoading ?? (data == null && !error);
  if (error) {
    return (
      <WidgetChrome
        title={cfg.title ?? 'Network'}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        error={String(error)}
        showErrors={cfg['show-errors']}
      />
    );
  }
  return (
    <WidgetChrome
      title={cfg.title ?? 'Network'}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      isLoading={!!loading}
    >
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
