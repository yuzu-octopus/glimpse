import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PagePayload } from '../../shared/api';
import type { WidgetType } from '../../shared/config';
import { PageView } from '../pages/PageView';
import { registerWidgetComponent } from '../widgets/registry';
import { __clearCacheForTests } from './usePageData';

function makePayload(overrides: Partial<PagePayload> = {}): PagePayload {
  return {
    name: 'Home',
    slug: 'home',
    width: 'default',
    tiling: 'columns',
    headWidgets: [],
    columns: [
      {
        size: 'full',
        widgets: [
          {
            type: 'clock' as WidgetType,
            config: { type: 'clock', title: 'Clock' },
            data: { time: '12:00' },
          },
        ],
      },
    ],
    ...overrides,
  };
}

function ndjsonResponse(chunks: unknown[]): Response {
  const body = chunks.map((c) => JSON.stringify(c)).join('\n') + '\n';
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/x-ndjson' },
  });
}

// Render count of the registered clock stub itself — RenderCounter as a
// sibling of PageView never re-renders when usePageData's setData fires, so
// it cannot measure dedupe. Counting the stub's own renders genuinely
// exercises skip-identical/emit-different.
let clockRenders = 0;

beforeEach(() => {
  clockRenders = 0;
  __clearCacheForTests();
  registerWidgetComponent('clock' as WidgetType, ({ config }) => {
    clockRenders++;
    return <div data-testid="clock-widget">{String(config.title)}</div>;
  });
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

afterEach(() => {
  __clearCacheForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('usePageData render-skip dedupe', () => {
  it('skips setData when the identical payload is re-emitted, emits when it differs', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          // First call: skeleton + one widget chunk
          return ndjsonResponse([
            { path: '$skeleton', payload: makePayload() },
            { path: 'columns[0].widgets[0]', payload: { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: '12:00' } } },
          ]);
        }
        // Subsequent calls: identical payload (no change)
        return ndjsonResponse([
          { path: '$skeleton', payload: makePayload() },
          { path: 'columns[0].widgets[0]', payload: { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: '12:00' } } },
        ]);
      }),
    );

    render(
      <MemoryRouter>
        <PageView slug="home" />
      </MemoryRouter>,
    );

    // Switch to real timers: findByTestId uses waitFor (setInterval polling),
    // which never fires under fake timers.
    vi.useRealTimers();
    await screen.findByTestId('clock-widget');
    vi.useFakeTimers();
    const rendersAfterFirstFetch = clockRenders;
    expect(rendersAfterFirstFetch).toBeGreaterThan(0);

    // Advance past STALE_MS so isStale() returns true and focus triggers revalidation
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_001);
    });

    // Trigger a revalidation (focus event)
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(10);
    });

    // The identical payload should be deduped — no additional renders
    expect(clockRenders).toBe(rendersAfterFirstFetch);

    // Now return a CHANGED payload
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        callCount++;
        return ndjsonResponse([
          { path: '$skeleton', payload: makePayload() },
          { path: 'columns[0].widgets[0]', payload: { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: '13:00' } } },
        ]);
      }),
    );
    // The second poll refreshed the cache timestamp — advance past STALE_MS
    // again so this focus revalidates against the changed payload.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_001);
    });
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(10);
    });

    // The changed payload should trigger a re-render
    expect(clockRenders).toBeGreaterThan(rendersAfterFirstFetch);
  });

  it('emits when the payload differs even if the version counter resets', async () => {
    vi.useFakeTimers();
    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          return ndjsonResponse([
            { path: '$skeleton', payload: makePayload() },
            { path: 'columns[0].widgets[0]', payload: { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: '12:00' } } },
          ]);
        }
        // Second call: different data
        return ndjsonResponse([
          { path: '$skeleton', payload: makePayload() },
          { path: 'columns[0].widgets[0]', payload: { type: 'clock', config: { type: 'clock', title: 'Clock' }, data: { time: '14:00' } } },
        ]);
      }),
    );

    render(
      <MemoryRouter>
        <PageView slug="home" />
      </MemoryRouter>,
    );

    // Switch to real timers: findByTestId uses waitFor (setInterval polling),
    // which never fires under fake timers.
    vi.useRealTimers();
    await screen.findByTestId('clock-widget');
    vi.useFakeTimers();
    const rendersAfterFirst = clockRenders;

    // Advance past STALE_MS so isStale() returns true and focus triggers revalidation
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_001);
    });

    // Trigger revalidation
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(10);
    });

    // Changed payload must emit
    expect(clockRenders).toBeGreaterThan(rendersAfterFirst);
  });
});
