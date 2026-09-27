import { Badge, ProgressBar, Stack, Text } from '@astryxdesign/core';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import type { AiQuotaConfig } from '../../../shared/widgets/ai-quota';
import type { AiQuotaData } from '../../../shared/widgets/payloads';
import { useNow } from '../_hooks/useRelativeTime';
import styles from './ai-quota.module.css';

function fmtReset(ms: number): string {
  const s = Math.max(0, Math.floor((ms - Date.now()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function AiQuota({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as AiQuotaConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  useNow(); // re-render each shared 60s tick so reset countdowns stay live
  if (loading) {
    return (
      <WidgetChrome
        title={cfg.title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        isLoading
      />
    );
  }
  if (error) {
    return (
      <WidgetChrome
        title={cfg.title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        error={error}
        showErrors={cfg['show-errors']}
      />
    );
  }
  const d = data as AiQuotaData;
  return (
    <WidgetChrome
      title={cfg.title ?? `${d.provider} quota`}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
    >
      <Stack gap={2}>
        {/* The plan is a tag, not a link and not a value: yellow owns chips, so
            the kit's yellow Badge carries the wash at 5px — no pill. */}
        {d.plan ? <Badge variant="yellow" label={d.plan} className={styles.plan} /> : null}
        {d.windows.map((w) => {
          const pct = Math.min(100, w.usedPercent);
          // Consumption is data, so the bar runs cyan and escalates on the fixed
          // status vocabulary (yellow attention, red negative) — the kit paints
          // the last two; only cyan needs a token override (see .fill below).
          const variant = pct > 90 ? 'error' : pct >= 70 ? 'warning' : 'accent';
          return (
            <Stack key={w.label} gap={1.5} className={styles.row}>
              <Text type="supporting" hasTabularNumbers>
                {w.label} — {Math.round(w.usedPercent)}% · resets in {fmtReset(w.resetsAt)}
              </Text>
              {/* The kit's bar supplies the track, the fill, the radius and the
                  role="progressbar" this widget used to hand-roll. The label is
                  sr-only: the visible sentence above is the real description. */}
              <ProgressBar
                value={pct}
                label={w.label}
                isLabelHidden
                variant={variant}
                className={styles.fill}
              />
            </Stack>
          );
        })}
        {d.balance !== undefined ? (
          <Text type="supporting" hasTabularNumbers className={styles.balance}>
            Balance: {d.balance}
          </Text>
        ) : null}
      </Stack>
    </WidgetChrome>
  );
}

registerWidgetComponent('ai-quota', AiQuota);

export default AiQuota;
