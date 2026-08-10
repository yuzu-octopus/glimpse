import { useMemo } from 'react';
import { calendarSchema } from '../../../shared/widgets/calendar';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './calendar.module.css';

function Calendar({ config }: WidgetComponentProps) {
  const cfg = calendarSchema.parse(config);
  const startMonday = (cfg['first-day-of-week'] ?? 'monday') === 'monday';
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + (startMonday ? 6 : 0)) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const out: { day: number; current: boolean }[] = [];
    for (let i = offset - 1; i >= 0; i--) {
      out.push({ day: daysInPrev - i, current: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ day: d, current: true });
    }
    while (out.length % 7 !== 0) {
      out.push({ day: out.length - offset - daysInMonth + 1, current: false });
    }
    return out;
  }, [year, month, startMonday]);

  const dows = startMonday
    ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
    : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const monthName = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
  }).format(now);

  return (
    <WidgetChrome title={cfg.title} hideHeader={cfg['hide-header']}>
      <div className={styles.month}>{monthName}</div>
      <div className={styles.grid}>
        {dows.map((d) => (
          <div key={d} className={styles.dow}>
            {d}
          </div>
        ))}
        {cells.map((c, i) => (
          <div
            key={i}
            className={`${styles.day} ${c.current ? '' : styles.other} ${c.current && c.day === now.getDate() ? styles.today : ''}`}
          >
            {c.day}
          </div>
        ))}
      </div>
    </WidgetChrome>
  );
}

registerWidgetComponent('calendar', Calendar);
