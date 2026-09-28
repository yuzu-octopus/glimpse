import { describe, expect, it } from 'vitest';
import { etagMatches } from './etag';

const ETAG = 'W/"abc123"';

// The 304 path in src/server/index.ts:246 hangs entirely on this predicate: a
// false positive revalidates a client forever, a false negative sends a full
// body when the client already holds it. It has to survive the shapes a real
// If-None-Match header arrives in — a list, a weak prefix, or `*`.
describe('etagMatches', () => {
  it('is false with no header at all', () => {
    expect(etagMatches(null, ETAG)).toBe(false);
    expect(etagMatches('', ETAG)).toBe(false);
  });

  it('matches the exact tag, weak prefix included', () => {
    expect(etagMatches(ETAG, ETAG)).toBe(true);
  });

  it('ignores the W/ prefix on either side', () => {
    // RFC 9110: a weak validator compares without its prefix, so a strong
    // If-None-Match must still revalidate a weak ETag.
    expect(etagMatches('"abc123"', ETAG)).toBe(true);
    expect(etagMatches(ETAG, '"abc123"')).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    expect(etagMatches(`  ${ETAG}  `, ETAG)).toBe(true);
  });

  it('finds the tag inside a comma-separated list', () => {
    expect(etagMatches(`"other", ${ETAG}, "another"`, ETAG)).toBe(true);
  });

  it('accepts the * wildcard on its own', () => {
    expect(etagMatches('*', ETAG)).toBe(true);
  });

  it('accepts * alongside other tags in a list', () => {
    expect(etagMatches(`"other", *`, ETAG)).toBe(true);
  });

  it('rejects a different tag, and a list without ours', () => {
    expect(etagMatches('"nope"', ETAG)).toBe(false);
    expect(etagMatches(`"one", "two"`, ETAG)).toBe(false);
  });
});
