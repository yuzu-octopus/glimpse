import { useEffect, useState } from 'react';
import { clockSchema } from '../../../shared/widgets/clock';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './clock.module.css';

function formatTime(d: Date, tz: string | undefined, hour12: boolean): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
    timeZone: tz,
  }).format(d);
}

function Clock({ config }: WidgetComponentProps) {
  const cfg = clockSchema.parse(config);
  const hour12 = (cfg['hour-format'] ?? '24h') === '12h';
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const date = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);

  return (
    <WidgetChrome title={cfg.title} hideHeader={cfg['hide-header']}>
      <div className={styles.time}>{formatTime(now, undefined, hour12)}</div>
      <div className={styles.date}>{date}</div>
      {cfg.timezones.length > 0 ? (
        <div className={styles.zones}>
          {cfg.timezones.map((z) => (
            <div key={z.timezone} className={styles.zone}>
              <span className={styles.zoneLabel}>
                {z.label ?? z.timezone}
              </span>
              <span className={styles.zoneTime}>
                {formatTime(now, z.timezone, hour12)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </WidgetChrome>
  );
}

registerWidgetComponent('clock', Clock);
