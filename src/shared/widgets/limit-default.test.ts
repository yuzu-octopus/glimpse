import { describe, expect, it } from 'vitest';
import { rssSchema, hackerNewsSchema, redditSchema, releasesSchema } from './feeds';
import { lobstersSchema, videosSchema, customApiSchema, repositorySchema } from './keyed';
describe('limit 5 defaults', () => {
  it('rss default limit 5', () => {
    expect(rssSchema.parse({ type: 'rss', feeds: [{ url: 'https://example.com' }] }).limit).toBe(5);
  });
  it('hacker-news default limit 5', () => {
    expect(hackerNewsSchema.parse({ type: 'hacker-news' }).limit).toBe(5);
  });
  it('reddit default limit 5', () => {
    expect(redditSchema.parse({ type: 'reddit', subreddit: 'pics' }).limit).toBe(5);
  });
  it('releases default limit 5', () => {
    expect(releasesSchema.parse({ type: 'releases', repositories: ['owner/repo'] }).limit).toBe(5);
  });
  it('lobsters default limit 5', () => {
    expect(lobstersSchema.parse({ type: 'lobsters' }).limit).toBe(5);
  });
  it('videos default limit 5', () => {
    expect(videosSchema.parse({ type: 'videos' }).limit).toBe(5);
  });
  it('custom-api default limit 5', () => {
    expect(customApiSchema.parse({ type: 'custom-api', url: 'https://example.com' }).limit).toBe(5);
  });
  it('repository defaults 5', () => {
    const cfg = repositorySchema.parse({ type: 'repository', repository: 'owner/repo' });
    expect(cfg['pull-requests-limit']).toBe(5);
    expect(cfg['issues-limit']).toBe(5);
  });
});
