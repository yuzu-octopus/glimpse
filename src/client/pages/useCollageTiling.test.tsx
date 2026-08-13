import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useCollageTiling } from './useCollageTiling';

/**
 * jsdom cannot compute layout, so these tests drive the hook with fake
 * geometry: tiles get mocked scrollHeight/clientHeight and the rAF pass is
 * flushed manually. Geometry is never asserted — only the spans the measure
 * pass derives from it.
 */

let rafCb: FrameRequestCallback | undefined;

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  cb: ResizeObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
    FakeResizeObserver.instances.push(this);
  }
  trigger() {
    this.cb([], this as unknown as ResizeObserver);
  }
}

function Harness({ heights }: { heights: number[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useCollageTiling(ref, [heights]);
  return (
    <div ref={ref} data-testid="container">
      {heights.map((_, i) => (
        <div key={i} data-tile={i} />
      ))}
    </div>
  );
}

/** Mirrors PageView's loading→ready flow: no container + empty deps while
 * loading, then the container mounts and deps grow to [payload]. */
function HydrationHarness({ ready }: { ready: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useCollageTiling(ref, ready ? [ready] : []);
  return ready ? (
    <div ref={ref} data-testid="container">
      <div data-tile={0} />
      <div data-tile={1} />
    </div>
  ) : null;
}

function tileEls(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-tile]'));
}

function setHeights(tiles: HTMLElement[], heights: number[]) {
  tiles.forEach((t, i) => {
    const h = heights[i] ?? 0;
    Object.defineProperty(t, 'scrollHeight', { configurable: true, value: h });
    Object.defineProperty(t, 'clientHeight', { configurable: true, value: h });
  });
}

function flushMeasure() {
  act(() => {
    rafCb?.(0);
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe('useCollageTiling', () => {
  it('computes row spans from content heights and applies them', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const { container: root } = render(<Harness heights={[0, 0, 0]} />);
    const container = root.querySelector('[data-testid="container"]') as HTMLElement;
    const tiles = tileEls(container);
    // heights 100/200/300 → rowUnit 100 → spans 1/2/3
    setHeights(tiles, [100, 200, 300]);
    flushMeasure();

    expect(container.style.getPropertyValue('--tile-row')).toBe('100px');
    expect(tiles.map((t) => t.style.gridRow)).toEqual([
      'span 1',
      'span 2',
      'span 3',
    ]);
    expect(tiles.map((t) => t.dataset.rowSpan)).toEqual(['1', '2', '3']);
  });

  it('clamps row spans to the 1-4 bound', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const { container: root } = render(<Harness heights={[0, 0]} />);
    const container = root.querySelector('[data-testid="container"]') as HTMLElement;
    const tiles = tileEls(container);
    // 100/800 → round(8) = 8 → clamp 4
    setHeights(tiles, [100, 800]);
    flushMeasure();

    expect(tiles.map((t) => t.dataset.rowSpan)).toEqual(['1', '4']);
  });

  it('skips identical passes (change guard)', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const { container: root } = render(<Harness heights={[0, 0]} />);
    const container = root.querySelector('[data-testid="container"]') as HTMLElement;
    const tiles = tileEls(container);
    const setProp = vi.spyOn(container.style, 'setProperty');

    setHeights(tiles, [100, 200]);
    flushMeasure();
    expect(setProp).toHaveBeenCalledTimes(1);

    // Same heights again → spans identical → nothing re-applied.
    flushMeasure();
    expect(setProp).toHaveBeenCalledTimes(1);

    // Changed heights → new spans → applied once more.
    setHeights(tiles, [100, 260]);
    flushMeasure();
    expect(setProp).toHaveBeenCalledTimes(2);
    expect(container.style.getPropertyValue('--tile-row')).toBe('100px');
    expect(tiles.map((t) => t.dataset.rowSpan)).toEqual(['1', '3']);
  });

  it('re-measures on container resize via the observer', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const { container: root } = render(<Harness heights={[0, 0]} />);
    const container = root.querySelector('[data-testid="container"]') as HTMLElement;
    const tiles = tileEls(container);
    expect(FakeResizeObserver.instances[0].observe).toHaveBeenCalledWith(container);

    setHeights(tiles, [100, 200]);
    flushMeasure();
    expect(tiles.map((t) => t.dataset.rowSpan)).toEqual(['1', '2']);

    // Resize: tiles grow → spans change → pass applies them.
    setHeights(tiles, [100, 400]);
    act(() => {
      FakeResizeObserver.instances[0].trigger();
      rafCb?.(0);
    });
    expect(tiles.map((t) => t.dataset.rowSpan)).toEqual(['1', '4']);
  });

  it('no-ops without a container or without tiles', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const { container: root } = render(<Harness heights={[]} />);
    const container = root.querySelector('[data-testid="container"]') as HTMLElement;
    setHeights([], []);
    expect(() => flushMeasure()).not.toThrow();
    expect(container.style.getPropertyValue('--tile-row')).toBe('');
  });

  it('re-runs when the container mounts and the deps array grows (loading→ready)', () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    const { container: root, rerender } = render(
      <HydrationHarness ready={false} />,
    );
    // loading: no container, empty deps — the measure pass no-ops.
    expect(root.querySelector('[data-testid="container"]')).toBeNull();

    // hydration: container mounts and deps grow from [] to [true]. React's
    // deps comparison ignores length changes (prefix-only), so without the
    // explicit deps.length element this effect never re-runs and the spans
    // are never applied — the live-browser bug this guards against.
    rerender(<HydrationHarness ready={true} />);
    const container = root.querySelector(
      '[data-testid="container"]',
    ) as HTMLElement;
    const tiles = tileEls(container);
    setHeights(tiles, [100, 300]);
    flushMeasure();

    expect(container.style.getPropertyValue('--tile-row')).toBe('100px');
    expect(tiles.map((t) => t.style.gridRow)).toEqual(['span 1', 'span 3']);
    expect(tiles.map((t) => t.dataset.rowSpan)).toEqual(['1', '3']);
  });

  it('cleans up observer and pending rAF on unmount', () => {
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCb = cb;
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', cancel);
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const { container: root, unmount } = render(
      <Harness heights={[0, 0]} />,
    );
    const container = root.querySelector('[data-testid="container"]') as HTMLElement;
    setHeights(tileEls(container), [100, 200]);
    flushMeasure();
    const observer = FakeResizeObserver.instances[0];

    unmount();
    expect(observer.disconnect).toHaveBeenCalled();
    expect(cancel).toHaveBeenCalled();
  });
});
