import { useState } from 'react';
import { Button } from '@astryxdesign/core';
import { ChevronRight } from 'lucide-react';
import { type LobstersConfig } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { formatAge } from '../_hooks/useRelativeTime';
import type { LobsterPost } from '../../../shared/widgets/payloads';
import Feed, { type FeedItem } from '../feed/feed';

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
        showErrors={cfg['show-errors']}
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
      showErrors={cfg['show-errors']}
    >
      <Feed items={visible} layout="list" emptyText="No posts" />
      {hasCollapse ? (
        <Button
          variant="ghost"
          size="sm"
          label={expanded ? 'Show less' : `Show more (${feedItems.length - (collapseAfter as number)})`}
          endContent={<ChevronRight size={12} />}
          onClick={() => setExpanded(!expanded)}
        />
      ) : null}
    </WidgetChrome>
  );
}

registerWidgetComponent('lobsters', Lobsters);

export default Lobsters;
