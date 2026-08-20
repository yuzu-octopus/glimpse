import type { HackerNewsConfig } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { formatAge } from '../useRelativeTime';
import type { HnPost } from '../../../shared/widgets/payloads';
import Feed, { type FeedItem } from '../feed/Feed';

/** post source host, minus www (glance rss-list shows the channel/domain). */
function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function toFeedItem(post: HnPost): FeedItem {
  const age = formatAge(post.ageSeconds);
  const domain = domainOf(post.url);
  const parts = [
    domain,
    `${post.score} points`,
    `${post.comments} comments`,
    age,
  ].filter(Boolean) as string[];
  return {
    title: post.title,
    url: post.url || post.commentsUrl,
    meta: parts.join(' • '),
  };
}

function HackerNews({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as HackerNewsConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const posts = ((data as { posts?: HnPost[] } | null)?.posts ?? []) as HnPost[];
  const title = cfg.title ?? (cfg['source-header'] ? 'Hacker News' : undefined);
  const feedItems = posts.map(toFeedItem);
  return (
    <WidgetChrome
      title={title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      collapseAfter={cfg['collapse-after']}
      isLoading={loading}
      error={error}
      items={feedItems.map((fi, i) => (
        <Feed key={posts[i]?.id ?? fi.url} items={[fi]} />
      ))}
    />
  );
}

registerWidgetComponent('hacker-news', HackerNews);

export default HackerNews;
