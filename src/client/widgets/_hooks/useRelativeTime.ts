import { useSyncExternalStore } from 'react';

const TICK_MS = 60_000;
const listeners = new Set<() => void>();
let tick = 0;
let timer: ReturnType<typeof setInterval> | null = null;

/** Single shared 60s ticker for the whole page: starts on first subscriber, stops on last. */
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (timer === null) {
    timer = setInterval(() => {
      tick++;
      listeners.forEach((l) => l());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return tick;
}

/** "5m ago" style relative time that ages by a minute per shared tick. */
/** Re-render once per shared 60s tick (countdowns, live ages); returns tick count. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useRelativeTime(ageSeconds: number): string {
  const ticks = useNow();
  return formatAge(ageSeconds + (ticks * TICK_MS) / 1000);
}

export function formatAge(totalSeconds: number): string {
  const s = Math.floor(Math.max(0, totalSeconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
