import { useEffect, useState } from 'react';
import type { ClockConfig } from '../../../shared/widgets/clock';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './clock.module.css';

/** Formatters cached per hour12/timezone combo (rebuilt each tick otherwise). */
const timeFormatters = new Map<string, Intl.DateTimeFormat>();

function formatTime(d: Date, tz: string | undefined, hour12: boolean): string {
  const key = `${hour12}:${tz ?? 'local'}`;
  let fmt = timeFormatters.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12,
      timeZone: tz,
    });
    timeFormatters.set(key, fmt);
  }
  return fmt.format(d);
}

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Minutes ahead of UTC for a timezone at `d` (local when tz is undefined). */
function offsetMinutes(tz: string | undefined, d: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'longOffset',
  }).formatToParts(d);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** Offset of a zone vs local time, e.g. "+3h" with title "3 hours ahead". */
function offsetBadge(tz: string, now: Date): { label: string; title: string } {
  const diff = offsetMinutes(tz, now) - offsetMinutes(undefined, now);
  if (diff === 0) return { label: '0h', title: 'Same time as local' };
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  const sign = diff > 0 ? '+' : '-';
  const label = mins === 0 ? `${sign}${hours}h` : `${sign}${hours}h ${mins}m`;
  const word = diff > 0 ? 'ahead' : 'behind';
  const h = `${hours} hour${hours === 1 ? '' : 's'}`;
  const title =
    mins === 0
      ? `${h} ${word}`
      : `${h} ${mins} minute${mins === 1 ? '' : 's'} ${word}`;
  return { label, title };
}

export function Clock({ config }: WidgetComponentProps) {
  const cfg = config as unknown as ClockConfig;
  const hour12 = (cfg['hour-format'] ?? '24h') === '12h';
  const timezones = cfg.timezones ?? [];
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const date = DATE_FORMAT.format(now);

  return (
    <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']}>
      <div className={styles.time}>{formatTime(now, undefined, hour12)}</div>
      <div className={styles.date}>{date}</div>
      {timezones.length > 0 ? (
        <>
          <div className={styles.separator} />
          <div className={styles.zones}>
            {timezones.map((z) => {
              const badge = offsetBadge(z.timezone, now);
              return (
                <div key={z.timezone} className={styles.zone}>
                  <span className={styles.zoneLabel}>
                    {z.label ?? z.timezone}
                  </span>
                  <span className={styles.zoneOffset} title={badge.title}>
                    {badge.label}
                  </span>
                  <span className={styles.zoneTime}>
                    {formatTime(now, z.timezone, hour12)}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </WidgetChrome>
  );
}

registerWidgetComponent('clock', Clock);
