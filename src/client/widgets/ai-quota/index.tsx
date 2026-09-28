import { Badge, Stack, Text } from '@astryxdesign/core';
import { DataBar } from 'astryx-dracula/shared/data-bar';
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
          // Consumption is data, so the mark runs cyan and escalates on the
          // fixed status vocabulary (yellow attention, red negative). Each
          // step is a --color-data-* role token, which is what the bar's
          // colour contract asks for, so the ladder lives in the prop rather
          // than in a stylesheet override.
          const color =
            pct > 90
              ? 'var(--color-data-categorical-red)'
              : pct >= 70
                ? 'var(--color-data-yellow-2)'
                : 'var(--color-data-categorical-cyan)';
          return (
            <Stack key={w.label} gap={1.5} className={styles.row}>
              <Text type="supporting" hasTabularNumbers>
                {w.label} — {Math.round(w.usedPercent)}% · resets in {fmtReset(w.resetsAt)}
              </Text>
              {/* A quota window is a magnitude against a domain, not progress
                  toward a completion: the fill and the unconsumed remainder
                  are two segments of one 100% total, so the bar's length
                  still reads as the percentage. It never completes. */}
              <DataBar
                label={w.label}
                height={8}
                segments={[
                  {id: 'used', value: pct, color},
                  {id: 'remaining', value: 100 - pct, color: 'var(--color-data-categorical-blue)'},
                ]}
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
