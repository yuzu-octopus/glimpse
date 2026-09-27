import { Badge, Stack, StatusDot, Text, type StatusDotVariant } from '@astryxdesign/core';
import type { TailscaleConfig } from '../../../shared/widgets/tailscale';
import type { TailscaleData, TailscaleDevice } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { useRelativeTime } from '../_hooks/useRelativeTime';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './tailscale.module.css';

/** One vocabulary for the dot: green for reachable, muted for not. An offline
 * node is not a failure — it is a laptop that went to sleep, so it never
 * borrows the red that a genuine error gets. */
const DOT_VARIANT: Record<'online' | 'offline', StatusDotVariant> = {
  online: 'success',
  offline: 'neutral',
};

/** "seen 3h ago", ageing on the shared 60s tick. Tailscale sends `lastSeen`
 * only while a node is disconnected, so this is the offline row's whole
 * supporting line. */
function LastSeen({ iso }: { iso: string }) {
  const at = Date.parse(iso);
  // A malformed timestamp parses to NaN, which would render as "NaN ago";
  // normalise it to 0 here and keep the hook unconditional so the call order
  // is the same on every row.
  const age = useRelativeTime(Number.isNaN(at) ? 0 : (Date.now() - at) / 1000);
  return (
    <Text type="supporting" maxLines={1} data-testid="ts-lastseen">
      seen {age} ago
    </Text>
  );
}

function DeviceRow({ device }: { device: TailscaleDevice }) {
  const state = device.online ? 'online' : 'offline';
  const detail = [device.os, device.clientVersion].filter(Boolean).join(' · ');
  return (
    <Stack
      direction="horizontal"
      gap={3}
      vAlign="center"
      className={device.online ? styles.row : `${styles.row} ${styles.rowOffline}`}
    >
      <StatusDot
        variant={DOT_VARIANT[state]}
        label={`${device.name} is ${state}`}
        data-testid={`ts-dot-${state}`}
      />
      <Stack gap={0.5} className={styles.body}>
        <Stack direction="horizontal" gap={2} vAlign="center">
          <Text maxLines={1}>{device.name}</Text>
          {/* `cyan`, not the kit's `info` — in astryx-dracula `info` is a solid
            purple fill, and purple is reserved for things you can click. An
            exit node is a fact, not an action: a 10% cyan wash + cyan border. */}
          {device.exitNode && <Badge variant="cyan" label="exit node" data-testid="ts-exit" />}
        </Stack>
        {device.online ? (
          detail ? (
            <Text type="supporting" maxLines={1}>
              {detail}
            </Text>
          ) : null
        ) : device.lastSeen ? (
          <LastSeen iso={device.lastSeen} />
        ) : (
          <Text type="supporting" maxLines={1}>
            offline
          </Text>
        )}
      </Stack>
      {device.address && (
        <Text type="code" className={styles.address} maxLines={1} data-testid="ts-address">
          {device.address}
        </Text>
      )}
    </Stack>
  );
}

function Tailscale({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as TailscaleConfig;
  const payload = (data ?? { devices: [] }) as TailscaleData;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  return (
    <WidgetChrome
      title={cfg.title ?? 'Tailnet'}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      error={error}
      showErrors={cfg['show-errors']}
      isLoading={loading}
      collapseAfter={10}
      items={payload.devices.map((d) => (
        <DeviceRow key={d.id} device={d} />
      ))}
    />
  );
}

registerWidgetComponent('tailscale', Tailscale);

export default Tailscale;
