/**
 * If-None-Match evaluation for the 304 path in `index.ts`.
 *
 * It lives here rather than in `index.ts` because that module calls
 * `Bun.serve` at module scope, so importing it under vitest throws
 * `ReferenceError: Bun is not defined`. That is why this predicate had no real
 * test for so long — the only one read `index.ts` as a string and asserted it
 * contained substrings, which passes even with the whole ETag implementation
 * deleted.
 *
 * Getting this wrong is expensive in both directions: a false positive pins a
 * client to a body it already holds, and a false negative re-sends the full
 * page forever. So the shapes a real header arrives in all matter — a list, a
 * weak prefix, or `*`.
 */
export function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  // RFC 9110: weak comparison strips the `W/` prefix from both sides.
  const normalize = (v: string): string => v.trim().replace(/^W\//i, '');
  const want = normalize(etag);
  if (header.trim() === '*') return true;
  return header.split(',').some((part) => normalize(part) === want || part.trim() === '*');
}
