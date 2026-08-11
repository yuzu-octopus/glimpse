import { useMemo } from 'react';
import type { CalendarConfig } from '../../../shared/widgets/calendar';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './calendar.module.css';

const MONTH_FORMAT = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
});

/** Weekday of the first grid column, monday=0 … sunday=6. */
const DAY_START: Record<string, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

const DOW_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function Calendar({ config }: WidgetComponentProps) {
  const cfg = config as unknown as CalendarConfig;
  const start = DAY_START[(cfg['first-day-of-week'] ?? 'monday').toLowerCase()] ?? 0;
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    // JS getDay() is sunday=0; convert to monday=0 then align to the start day.
    const offset = (((first.getDay() + 6) % 7) - start + 7) % 7;
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
  }, [year, month, start]);

  const dows = [...DOW_LABELS.slice(start), ...DOW_LABELS.slice(0, start)];
  const monthName = MONTH_FORMAT.format(now);

  return (
    <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']}>
      <div className={styles.month}>{monthName}</div>
      <div className={styles.grid}>
        {dows.map((d) => (
          <div key={d} className={styles.dow}>
            {d}
          </div>
        ))}
        {cells.map((c) => (
          <div
            key={`${c.current ? 'c' : 'p'}-${c.day}`}
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

export default Calendar;
