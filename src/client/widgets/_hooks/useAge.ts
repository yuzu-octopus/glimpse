import { useMemo } from 'react';
import { useRelativeTime } from './useRelativeTime';

/**
 * Deep seam: string (ISO published) -> string (live age like "2h").
 * Hides Date.parse + formatAge + the shared 60s ticker.
 * Returns "" for null/empty/invalid so callers can conditionally hide meta.
 */
export function useAge(published: string | null | undefined): string {
  const valid = !!published && !Number.isNaN(Date.parse(published));
  const baseAgeSeconds = useMemo(() => {
    if (!valid || !published) return 0;
    return (Date.now() - Date.parse(published)) / 1000;
  }, [published, valid]);
  const live = useRelativeTime(baseAgeSeconds);
  if (!valid) return '';
  return live;
}
