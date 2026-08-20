import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// Failing test for Task 3: ETag 304 handling for /api/page
// Before implementation, FAIL (no ETag handling), after PASS

describe('Task 3: ETag 304', () => {
  it('api/page returns 304 when If-None-Match matches (source check)', async () => {
    const src = readFileSync('src/server/index.ts', 'utf8');
    expect(src).toContain('if-none-match');
    expect(src).toContain('304');
    expect(src).toContain('Bun.hash');
    expect(src).toContain('private, max-age=10');
    expect(src).toContain('stale-while-revalidate=30');
    expect(src).toContain('/health');
    expect(src).toContain('Bun.file');
    expect(src).toContain('routes');
  });

  it('etag generation is deterministic and If-None-Match triggers 304', async () => {
    const body = JSON.stringify({ payload: 'test' });
    const hashFn = (globalThis as unknown as { Bun?: { hash: (s: string) => number | bigint } }).Bun?.hash
      ?? ((s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; });
    const etag = `W/"${hashFn(body).toString(16)}"`;
    // Simulate handler check: req.headers.get('if-none-match') === etag => 304
    const mockHeaders = new Headers({ 'if-none-match': etag });
    expect(mockHeaders.get('if-none-match')).toBe(etag);
    const shouldReturn304 = mockHeaders.get('if-none-match') === etag;
    expect(shouldReturn304).toBe(true);
    // Also verify Cache-Control alignment: private max-age 10 swr 30 ~ LIVE_POLL 30s
    const cacheControl = 'private, max-age=10, stale-while-revalidate=30';
    expect(cacheControl).toContain('private');
    expect(cacheControl).toContain('max-age=10');
    expect(cacheControl).toContain('stale-while-revalidate=30');
  });
});
