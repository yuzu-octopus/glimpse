import { eventsCalendarSchema } from '../../shared/widgets/calendar';
import type { CalendarEvent } from '../../shared/widgets/payloads';
import { fetchText } from './http';
import { registerWidget, type WidgetFetchContext } from './registry';

const DAY_MS = 86_400_000;

/** RFC 5545 line unfolding: a line starting with space/tab continues the previous one. */
function unfold(ics: string): string[] {
  const out: string[] = [];
  for (const line of ics.split(/\r?\n/)) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else if (line.length > 0) {
      out.push(line);
    }
  }
  return out;
}

function parseIcsDate(value: string): { date: Date; allDay: boolean } | null {
  const v = value.trim();
  let m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (m) {
    // No trailing Z → floating time, interpreted as server-local per RFC 5545.
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7]}`);
    return Number.isNaN(d.getTime()) ? null : { date: d, allDay: false };
  }
  m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : { date: d, allDay: true };
  }
  return null;
}

interface RawEvent {
  start?: { date: Date; allDay: boolean };
  end?: Date;
  summary?: string;
  location?: string;
  rrule?: string;
}

function propOf(line: string): { name: string; value: string } {
  const i = line.indexOf(':');
  if (i < 0) return { name: '', value: '' };
  return { name: line.slice(0, i).split(';')[0].toUpperCase(), value: line.slice(i + 1) };
}

function parseRawEvents(lines: string[]): RawEvent[] {
  const events: RawEvent[] = [];
  let current: RawEvent | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
    } else if (line === 'END:VEVENT') {
      if (current?.start) events.push(current);
      current = null;
    } else if (current) {
      const { name, value } = propOf(line);
      if (name === 'DTSTART') current.start = parseIcsDate(value) ?? undefined;
      else if (name === 'DTEND') {
        const d = parseIcsDate(value);
        if (d && !d.allDay) current.end = d.date;
      } else if (name === 'SUMMARY') current.summary = value;
      else if (name === 'LOCATION') current.location = value;
      else if (name === 'RRULE') current.rrule = value.toUpperCase();
    }
  }
  return events;
}

/** Minimal RRULE support: FREQ=DAILY|WEEKLY with COUNT/INTERVAL/UNTIL. */
function expand(
  ev: RawEvent,
  now: number,
  windowEnd: number,
): Array<{ start: Date; end: Date | null }> {
  const start = ev.start!.date;
  const durationMs = ev.end ? Math.max(ev.end.getTime() - start.getTime(), 0) : DAY_MS;
  let stepDays = 1;
  let count = 1;
  let untilMs = Number.POSITIVE_INFINITY;
  const freq = /FREQ=(DAILY|WEEKLY)/.exec(ev.rrule ?? '')?.[1];
  if (freq) {
    stepDays = freq === 'WEEKLY' ? 7 : 1;
    count = Number(/COUNT=(\d+)/.exec(ev.rrule ?? '')?.[1] ?? 1);
    const interval = Number(/INTERVAL=(\d+)/.exec(ev.rrule ?? '')?.[1] ?? 1);
    stepDays *= interval;
    const until = /UNTIL=(\d{8}(?:T\d{6}Z?)?)/.exec(ev.rrule ?? '')?.[1];
    if (until) {
      const parsed = parseIcsDate(until);
      if (parsed) untilMs = parsed.date.getTime();
    }
  }
  const occurrences: Array<{ start: Date; end: Date | null }> = [];
  for (let i = 0; i < count; i++) {
    const s = new Date(start.getTime() + i * stepDays * DAY_MS);
    if (s.getTime() > windowEnd) break;
    if (s.getTime() > untilMs) break;
    // Skip occurrences that already ended before "now".
    if (s.getTime() + durationMs < now) continue;
    occurrences.push({
      start: s,
      end: ev.end ? new Date(s.getTime() + durationMs) : null,
    });
  }
  return occurrences;
}

function collectEvents(text: string, now: number, windowEnd: number): CalendarEvent[] {
  const out: CalendarEvent[] = [];
  for (const ev of parseRawEvents(unfold(text))) {
    for (const occ of expand(ev, now, windowEnd)) {
      out.push({
        title: ev.summary ?? '(untitled event)',
        startISO: occ.start.toISOString(),
        ...(occ.end ? { endISO: occ.end.toISOString() } : {}),
        ...(ev.location ? { location: ev.location } : {}),
        allDay: ev.start!.allDay,
      });
    }
  }
  return out;
}

registerWidget('events-calendar', async (ctx: WidgetFetchContext, config) => {
  const cfg = eventsCalendarSchema.parse(config);
  const urls = [...(cfg.urls ?? []), ...(cfg['ics-url'] ? [cfg['ics-url']] : [])];
  const now = Date.now();
  const windowEnd = now + cfg.days * DAY_MS;
  const results = await Promise.allSettled(
    urls.map((u) => fetchText(ctx, u, { headers: { Accept: 'text/calendar' } })),
  );
  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  if (fulfilled.length === 0) {
    throw new Error(`all ${urls.length} calendar feed(s) failed`);
  }
  const events = fulfilled
    .flatMap((r) => collectEvents((r as PromiseFulfilledResult<string>).value, now, windowEnd))
    .sort((a, b) => a.startISO.localeCompare(b.startISO))
    .slice(0, cfg.limit);
  return { events };
});
