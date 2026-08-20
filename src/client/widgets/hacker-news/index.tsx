import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { HackerNewsConfig } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { formatAge } from '../useRelativeTime';
import type { HnPost } from '../../../shared/widgets/payloads';
import Feed, { type FeedItem } from '../feed/Feed';
import chromeStyles from '../../components/widget-chrome.module.css';

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
  const collapseAfter = cfg['collapse-after'];
  const [expanded, setExpanded] = useState(false);
  const hasCollapse =
    typeof collapseAfter === 'number' && collapseAfter >= 0 && feedItems.length > collapseAfter;
  const visible = hasCollapse && !expanded ? feedItems.slice(0, collapseAfter) : feedItems;

  if (loading) {
    return (
      <WidgetChrome
        title={title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        isLoading
        error={error}
      />
    );
  }
  return (
    <WidgetChrome
      title={title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      isLoading={loading}
      error={error}
    >
      <Feed items={visible} layout="list" />
      {hasCollapse ? (
        expanded ? (
          <button
            type="button"
            className={`${chromeStyles.more} ${chromeStyles.moreExpanded}`}
            onClick={() => setExpanded(false)}
          >
            Show less
            <ChevronRight size={12} className={chromeStyles.chevron} />
          </button>
        ) : (
          <button type="button" className={chromeStyles.more} onClick={() => setExpanded(true)}>
            {`Show more (${feedItems.length - (collapseAfter as number)})`}
            <ChevronRight size={12} className={chromeStyles.chevron} />
          </button>
        )
      ) : null}
    </WidgetChrome>
  );
}

registerWidgetComponent('hacker-news', HackerNews);

export default HackerNews;
