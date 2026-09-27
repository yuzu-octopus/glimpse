import { useMemo, useState } from 'react';
import { Grid, IconButton, Stack, Text } from '@astryxdesign/core';
import { ChevronLeft, ChevronRight, Undo2 } from 'lucide-react';
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

/** Glance renders a fixed six-week grid (static/js/calendar.js:4,
 * FULL_MONTH_SLOTS = 7*6) so scrubbing never resizes the widget — a variable
 * tail would leave blank slots and reflow between four and six rows. */
const FULL_MONTH_SLOTS = 7 * 6;

function Calendar({ config }: WidgetComponentProps) {
  const cfg = config as unknown as CalendarConfig;
  const start = DAY_START[(cfg['first-day-of-week'] ?? 'monday').toLowerCase()] ?? 0;

  // The clock is read on every render rather than on a midnight ticker, so the
  // clamp below notices a month rolling over even while the widget sits idle.
  const now = new Date();
  // Months are a single ordered integer, `year * 12 + month`. Glance compares
  // year+month pairs via `datesWithinSameMonth` (static/js/calendar.js:195);
  // one number makes both "is this the current month" and "is this in the
  // future" plain comparisons.
  const currentMonth = now.getFullYear() * 12 + now.getMonth();

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

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    // JS getDay() is sunday=0; convert to monday=0 then align to the start day.
    const offset = (((first.getDay() + 6) % 7) - start + 7) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();
    const out: { id: string; day: number; current: boolean }[] = [];
    for (let i = offset - 1; i >= 0; i--) {
      out.push({ id: `prev-${i}`, day: daysInPrev - i, current: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      out.push({ id: `cur-${d}`, day: d, current: true });
    }
    for (let d = 1; out.length < FULL_MONTH_SLOTS; d++) {
      out.push({ id: `next-${d}`, day: d, current: false });
    }
    return out;
  }, [year, month, start]);

  const dows = useMemo(
    () => [...DOW_LABELS.slice(start), ...DOW_LABELS.slice(0, start)],
    [start],
  );

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
          {dows.map((d) => (
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
          {cells.map((c) => {
            const isToday = isCurrent && c.current && c.day === now.getDate();
            return (
              <Text
                key={c.id}
                as="div"
                type="body"
                hasTabularNumbers
                aria-current={isToday ? 'date' : undefined}
                className={`${styles.day} ${c.current ? '' : styles.other} ${isToday ? styles.today : ''}`}
              >
                {c.day}
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
