import { useState } from 'react';
import { Grid, IconButton, Stack, Text, useCalendarDays, type DayOfWeek } from '@astryxdesign/core';
import { ChevronLeft, ChevronRight, Undo2 } from 'lucide-react';
import type { CalendarConfig } from '../../../shared/widgets/calendar';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './calendar.module.css';

const MONTH_FORMAT = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
});

/** First grid column, in the kit's sunday=0 … saturday=6 order. */
const DAY_START: Record<string, DayOfWeek> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function Calendar({ config }: WidgetComponentProps) {
  const cfg = config as unknown as CalendarConfig;
  const start = DAY_START[(cfg['first-day-of-week'] ?? 'monday').toLowerCase()] ?? 1;

  // The clock is read on every render rather than on a midnight ticker, so the
  // clamp below notices a month rolling over even while the widget sits idle.
  const now = new Date();
  // Months are a single ordered integer, `year * 12 + month`. Glance compares
  // year+month pairs via `datesWithinSameMonth` (static/js/calendar.js:195);
  // one number makes both "is this the current month" and "is this in the
  // future" plain comparisons.
  const currentMonth = now.getFullYear() * 12 + now.getMonth();
  // A day is identified by its ISO date, so today is one string comparison and
  // the highlight needs no month arithmetic of its own.
  const month1 = String(now.getMonth() + 1).padStart(2, '0');
  const day1 = String(now.getDate()).padStart(2, '0');
  const today = `${now.getFullYear()}-${month1}-${day1}`;

  const [view, setView] = useState(currentMonth);
  // 0 until the first scrub, so the initial paint does not animate.
  const [dir, setDir] = useState<-1 | 0 | 1>(0);
  const isCurrent = view === currentMonth;

  // Glance steps a whole month at a time and leaves both directions open
  // (static/js/calendar.js:59-61). We keep the step and its "back to current
  // month" affordance, but clamp at today so the widget can never open onto a
  // month that has not happened yet.
  const step = (delta: -1 | 1) => {
    const next = view + delta;
    if (next > currentMonth) return;
    setDir(delta);
    setView(next);
  };

  const year = Math.floor(view / 12);
  const month = view % 12;

  // The kit owns the grid: the weekday labels, the day arithmetic and the
  // outside-month spillover. `hasVariableRowCount` stays off because Glance
  // renders a fixed six-week grid (static/js/calendar.js:4,
  // FULL_MONTH_SLOTS = 7*6) so scrubbing never resizes the widget — a variable
  // tail would leave blank slots and reflow between four and six rows.
  const { days, dayNames } = useCalendarDays({ year, month: month + 1, weekStartsOn: start });

  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
    >
      <Stack gap={3}>
        <Stack direction="horizontal" hAlign="between" vAlign="center" gap={2}>
          <Stack direction="horizontal" hAlign="start" vAlign="center" gap={1}>
            <Text type="body" weight="semibold" hasTabularNumbers>
              {MONTH_FORMAT.format(new Date(year, month, 1))}
            </Text>
            {isCurrent ? null : (
              <IconButton
                className={styles.nav}
                label="Back to current month"
                icon={<Undo2 size={16} />}
                variant="ghost"
                size="sm"
                onClick={() => {
                  // The clamp guarantees the view is never ahead of today, so
                  // going home is always a step forward.
                  setDir(1);
                  setView(currentMonth);
                }}
              />
            )}
          </Stack>
          <Stack direction="horizontal" hAlign="end" vAlign="center" gap={1}>
            <IconButton
              className={styles.nav}
              label="Previous month"
              icon={<ChevronLeft size={16} />}
              variant="ghost"
              size="sm"
              onClick={() => step(-1)}
            />
            <IconButton
              className={styles.nav}
              label="Next month"
              icon={<ChevronRight size={16} />}
              variant="ghost"
              size="sm"
              isDisabled={isCurrent}
              onClick={() => step(1)}
            />
          </Stack>
        </Stack>

        <Grid columns={7} align="center" justify="center" columnGap={0.5}>
          {dayNames.map((d) => (
            <Text key={d} as="div" type="supporting" className={styles.dow}>
              {d}
            </Text>
          ))}
        </Grid>

        {/* Keyed on the displayed month so a scrub remounts the grid and
            replays the entrance. */}
        <Grid
          key={view}
          columns={7}
          align="center"
          justify="center"
          columnGap={0.5}
          className={dir === -1 ? styles.slidePrev : dir === 1 ? styles.slideNext : undefined}
        >
          {days.map((d) => {
            const isToday = d.iso === today;
            return (
              <Text
                key={d.iso}
                as="div"
                type="body"
                hasTabularNumbers
                aria-current={isToday ? 'date' : undefined}
                className={`${styles.day} ${d.isOutside ? styles.other : ''} ${isToday ? styles.today : ''}`}
              >
                {d.dayNumber}
              </Text>
            );
          })}
        </Grid>
      </Stack>
    </WidgetChrome>
  );
}

registerWidgetComponent('calendar', Calendar);

export default Calendar;
