import { useEffect, useState } from 'react';

/** "5m ago" style relative time that ages by a minute per tick. */
export function useRelativeTime(ageSeconds: number): string {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 60), 60_000);
    return () => clearInterval(id);
  }, []);
  return formatAge(ageSeconds + elapsed);
}

export function formatAge(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
