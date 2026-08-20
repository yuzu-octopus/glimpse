import type { LobstersConfig } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { formatAge } from '../useRelativeTime';
import type { LobsterPost } from '../../../shared/widgets/payloads';
import Feed, { type FeedItem } from '../feed/Feed';

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function Lobsters({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as LobstersConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const posts = ((data as { posts?: LobsterPost[] } | null)?.posts ?? []) as LobsterPost[];
  const title = cfg.title ?? (cfg['source-header'] ? 'Lobsters' : undefined);
  const feedItems: FeedItem[] = posts.map((post) => {
    const age = formatAge(post.ageSeconds);
    const domain = domainOf(post.url);
    const parts = [domain, `${post.score} points`, `${post.comments} comments`, age].filter(Boolean) as string[];
    return {
      title: post.title,
      url: post.url || post.commentsUrl,
      meta: parts.join(' • '),
      tags: post.tags,
    };
  });
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

registerWidgetComponent('lobsters', Lobsters);

export default Lobsters;
