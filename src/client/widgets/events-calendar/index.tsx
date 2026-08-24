import { useMemo } from 'react';
import type { EventsCalendarConfig } from '../../../shared/widgets/calendar';
import type { CalendarEvent } from '../../../shared/widgets/payloads';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './events-calendar.module.css';

const TIME_FMT = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });
const DAY_FMT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric' });

/** Local midnight of `d`, for whole-day comparisons. */
function midnight(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function dayLabel(start: Date, now: Date): string {
  const diffDays = Math.round((midnight(start) - midnight(now)) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return DAY_FMT.format(start);
}

interface DayGroup {
  key: string;
  label: string;
  events: CalendarEvent[];
}

function groupByDay(events: CalendarEvent[], now: Date): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const ev of events) {
    const start = new Date(ev.startISO);
    const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
    // Events arrive sorted, so same-day items are always consecutive.
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.events.push(ev);
      continue;
    }
    groups.push({ key, label: dayLabel(start, now), events: [ev] });
  }
  return groups;
}

function timeRange(ev: CalendarEvent): string {
  if (ev.allDay) return 'All day';
  const start = TIME_FMT.format(new Date(ev.startISO));
  const end = ev.endISO ? TIME_FMT.format(new Date(ev.endISO)) : null;
  return end ? `${start}–${end}` : start;
}

function EventsCalendar({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as EventsCalendarConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const events = ((data as { events?: CalendarEvent[] } | null)?.events ?? []) as CalendarEvent[];

  const groups = useMemo(() => groupByDay(events, new Date()), [events]);

  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      isLoading={loading}
      error={error}
    >
      <div className={styles.events}>
        {groups.length === 0 ? <div className={styles.empty}>No upcoming events</div> : null}
        {groups.map((group) => (
          <div key={group.key} role="group" aria-label={group.label}>
            <div className={styles.dayHeader}>{group.label}</div>
            {group.events.map((ev) => (
              <div key={`${ev.startISO}-${ev.title}`} className={styles.event}>
                <div className={styles.top}>
                  <span className={styles.time}>{timeRange(ev)}</span>
                  <span className={styles.title}>{ev.title}</span>
                </div>
                {ev.location ? <div className={styles.location}>{ev.location}</div> : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </WidgetChrome>
  );
}

registerWidgetComponent('events-calendar', EventsCalendar);

export default EventsCalendar;
