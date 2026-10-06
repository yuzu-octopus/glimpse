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
  const [history, setHistory] = useState<(number | null)[]>([]);
  const latest = useRef<number | null>(null);
  useEffect(() => {
    // A failed probe is not a reading: it clears the last one so the next
    // tick records a hole rather than repeating a stale value as if it were
    // fresh.
    latest.current = d?.ttfbMs ?? null;
  }, [d?.ttfbMs]);
  // The series is a time series, not an arrival log: it samples on its own
  // tick and records whatever the last reading was — including nothing at
  // all, because a tick that produced no reading still happened. Skipping
  // it would let a long outage chart as a short, healthy-looking window of
  // only the samples that survived. Keying it on the reading value — the
  // obvious version — appends nothing while the link is steady, which on a
  // LAN it always is, so the sparkline never draws at all. A flat line is
  // what steady looks like. The target is the series' identity: a page can
  // swap one network card for another in the same slot, and that card's
  // history is not this one's.
  const series = String(cfg['ping-target'] ?? NETWORK_DEFAULTS.pingTarget);
  useEffect(() => {
    setHistory([]);
    const id = setInterval(() => {
      setHistory((h) => [...h.slice(-(SAMPLES - 1)), latest.current]);
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, [series]);
  const loading = isLoading ?? (data == null && !error);
  // The scale comes from the readings alone: a hole is the absence of a
  // value, and letting one into the max would flatten the real bars.
  const max = Math.max(...history.filter((v): v is number => v != null), 1);
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
      {/* Responsive, not fixed: three equal tracks crushed each value to a
          few px in a narrow column (a tablet/phone span-3 tile), clipping
          IPs and latencies to ellipses. minWidth 72 keeps all three across
          on desktop (≥1180) and stacks to 1-2 in a narrow tile. */}
      <Grid columns={{ minWidth: 72, max: 3 }} gap={2}>
        <Stack gap={0.5}>
          <Text type="label">Local</Text>
          <Text hasTabularNumbers>{d?.localIp ?? '—'}</Text>
        </Stack>
        <Stack gap={0.5}>
          <Text type="label">Public</Text>
          <Text hasTabularNumbers>{d?.publicIp ?? '—'}</Text>
        </Stack>
        <Stack gap={0.5}>
          <Text type="label">TTFB</Text>
          <Text hasTabularNumbers>{d?.ttfbMs != null ? `${d.ttfbMs} ms` : '—'}</Text>
        </Stack>
      </Grid>
      {/* Data ink, not layout chrome: the inline heights ARE the series, so the
          bars stay hand-sized. One series means one hue — a sequential ramp
          would turn a single quantitative series into a rainbow. */}
      {history.length > 1 ? (
        <Stack direction="horizontal" gap={0.5} vAlign="end" height={24} className={styles.spark}>
          {history.map((v, i) =>
            // A tick with no reading takes its slot as a hole. A short bar
            // there would read as a very fast response, which is the one
            // thing a failed probe is not.
            v == null ? (
              <span key={i} className={styles.gap} />
            ) : (
              <span key={i} style={{ height: `${Math.round((v / max) * 20) + 2}px` }} className={styles.bar} />
            ),
          )}
        </Stack>
      ) : null}
    </WidgetChrome>
  );
}

registerWidgetComponent('network', Network);
export default Network;
