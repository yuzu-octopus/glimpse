import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function srcOf(p: string) {
  return readFileSync(p, 'utf8');
}

describe('Feed tree — raw flexible → premade (releases custom)', () => {
  it('rss uses Feed as premade wrapper', () => {
    const src = srcOf('src/client/widgets/rss/index.tsx');
    expect(src).toContain("from '../feed/Feed'");
    // premade: single Feed with layout list, not per-row hack; check for layout prop
    expect(src).toMatch(/<Feed[^>]*layout=/);
  });

  it('hn uses Feed as premade wrapper', () => {
    const src = srcOf('src/client/widgets/hacker-news/index.tsx');
    expect(src).toContain("from '../feed/Feed'");
    expect(src).toMatch(/<Feed[^>]*layout=/);
  });

  it('lobsters uses Feed as premade wrapper', () => {
    const src = srcOf('src/client/widgets/lobsters/index.tsx');
    expect(src).toContain("from '../feed/Feed'");
    expect(src).toMatch(/<Feed[^>]*layout=/);
  });

  it('reddit vertical uses Feed as premade wrapper', () => {
    const src = srcOf('src/client/widgets/reddit/index.tsx');
    expect(src).toContain("from '../feed/Feed'");
    expect(src).toMatch(/<Feed[^>]*layout=/);
  });

  it('videos vertical uses Feed as premade wrapper', () => {
    const src = srcOf('src/client/widgets/videos/index.tsx');
    expect(src).toContain("from '../feed/Feed'");
    // vertical-list branch must use Feed with layout
    expect(src).toMatch(/vertical-list[\s\S]*?<Feed[^>]*layout=/);
  });

  it('Feed is deep module: items + layout + xstyle granular (StyleX)', () => {
    const src = srcOf('src/client/widgets/feed/Feed.tsx');
    expect(src).toContain('layout');
    expect(src).toContain('xstyle');
    expect(src).toContain('stylex');
    expect(src).toMatch(/FeedItem/);
  });

  it('releases stays custom (not via Feed)', () => {
    const src = srcOf('src/client/widgets/releases/index.tsx');
    expect(src).not.toContain("from '../feed/Feed'");
    expect(src).toContain('ReleaseRow');
  });
});
