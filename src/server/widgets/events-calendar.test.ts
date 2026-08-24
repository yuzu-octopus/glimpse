import { describe, expect, it, vi, afterEach } from 'vitest';
import { Singleflight, TtlCache } from '../cache';
import { serverWidgets, type WidgetFetchContext } from './registry';
import './events-calendar';

// Wed 2026-08-24 12:00 UTC — fixed "now" so past/present filtering is deterministic.
const NOW = new Date('2026-08-24T12:00:00Z');

const ICS_FIXTURE = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'DTSTART:20260820T100000Z',
  'DTEND:20260820T110000Z',
  'SUMMARY:Past meetup',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:20260825T180000Z',
  'DTEND:20260825T190000Z',
  'SUMMARY:Deploy review',
  'LOCATION:Zoom',
  'DESCRIPTION:Quarterly deploy walkthrough',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART;VALUE=DATE:20260827',
  'SUMMARY:Conference',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'DTSTART:20260826T090000Z',
  'DTEND:20260826T093000Z',
  'SUMMARY:Weekly sync',
  'RRULE:FREQ=WEEKLY;COUNT=3',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

function makeCtx(fetchImpl: (url: string) => Promise<Response>): WidgetFetchContext {
  return {
    fetch: vi.fn(fetchImpl) as unknown as typeof fetch,
    env: {},
    cache: new TtlCache(),
    singleflight: new Singleflight(),
  };
}

const fetcher = () => serverWidgets.get('events-calendar')!;

afterEach(() => {
  vi.useRealTimers();
});

describe('events-calendar fetcher', () => {
  it('parses events, expands the weekly RRULE, drops past events and sorts', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const ctx = makeCtx(async () => new Response(ICS_FIXTURE, { status: 200 }));
    const data = (await fetcher()(ctx, { type: 'events-calendar', urls: ['https://example.com/cal.ics'] })) as {
      events: { title: string; startISO: string; endISO?: string; location?: string; allDay: boolean }[];
    };
    // Past meetup dropped; weekly #3 (Sep 9) falls outside the 14-day window.
    expect(data.events.map((e) => e.title)).toEqual([
      // All-day events sort by their local-midnight start.
      'Deploy review',
      'Weekly sync',
      'Conference',
      'Weekly sync',
    ]);
    expect(data.events[0].startISO).toBe('2026-08-25T18:00:00.000Z');
    expect(data.events[0].endISO).toBe('2026-08-25T19:00:00.000Z');
    expect(data.events[0].location).toBe('Zoom');
    expect(data.events[2].allDay).toBe(true);
  });

  it('accepts a single ics-url', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const ctx = makeCtx(async () => new Response(ICS_FIXTURE, { status: 200 }));
    const data = (await fetcher()(ctx, { type: 'events-calendar', 'ics-url': 'https://example.com/cal.ics' })) as {
      events: unknown[];
    };
    expect(data.events.length).toBeGreaterThan(0);
  });

  it('applies the limit', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const ctx = makeCtx(async () => new Response(ICS_FIXTURE, { status: 200 }));
    const data = (await fetcher()(ctx, { type: 'events-calendar', urls: ['https://example.com/cal.ics'], limit: 2 })) as {
      events: unknown[];
    };
    expect(data.events).toHaveLength(2);
  });

  // No fake timers here: fetchWithRetry's real backoff delays would never
  // advance. The assertion is failure-tolerance only, so wall-clock now is fine.
  it('merges multiple feeds and tolerates a broken one', async () => {
    const ctx = makeCtx(async (url) =>
      url.includes('broken')
        ? new Response('nope', { status: 500 })
        : new Response(ICS_FIXTURE, { status: 200 }),
    );
    const data = (await fetcher()(ctx, {
      type: 'events-calendar',
      urls: ['https://example.com/ok.ics', 'https://example.com/broken.ics'],
    })) as { events: unknown[] };
    expect(data.events.length).toBeGreaterThan(0);
  });

  it('throws when every feed fails', async () => {
    const ctx = makeCtx(async () => new Response('nope', { status: 500 }));
    await expect(
      fetcher()(ctx, { type: 'events-calendar', urls: ['https://example.com/x.ics'] }),
    ).rejects.toThrow();
  });

  it('rejects config without any url', async () => {
    const ctx = makeCtx(async () => new Response('', { status: 200 }));
    await expect(fetcher()(ctx, { type: 'events-calendar' })).rejects.toThrow();
  });
});
