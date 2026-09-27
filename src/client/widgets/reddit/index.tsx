import { useState } from 'react';
import { Button, ClickableCard, Grid, HStack, Text } from '@astryxdesign/core';
import { ChevronRight } from 'lucide-react';
import { REDDIT_DEFAULTS, type RedditConfig } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { formatAge } from '../_hooks/useRelativeTime';
import type { RedditPost } from '../../../shared/widgets/payloads';
import styles from './reddit.module.css';
import Feed, { type FeedItem } from '../feed/feed';
void REDDIT_DEFAULTS;

const CARD_TITLE_LINES = 3;

function Card({ post, showMeta }: { post: RedditPost; showMeta: boolean }) {
  const age = formatAge(post.ageSeconds);
  return (
    <ClickableCard
      label={post.title}
      href={post.url}
      target="_blank"
      padding={0}
      className={styles.card}
    >
      {post.thumbnail ? (
        <img src={post.thumbnail} alt="" loading="lazy" className={styles.cardThumb} />
      ) : (
        <div className={styles.cardThumbPlaceholder} aria-hidden="true" />
      )}
      <div className={styles.cardBody}>
        <Text type="body" maxLines={CARD_TITLE_LINES}>
          {post.title}
        </Text>
        {showMeta ? <Text type="supporting">{`${post.score} points · ${age}`}</Text> : null}
      </div>
    </ClickableCard>
  );
}

function Reddit({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as RedditConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const posts = ((data as { posts?: RedditPost[] } | null)?.posts ?? []) as RedditPost[];
  const showThumb = cfg['show-thumbnails'] === true;
  const showFlair = cfg['show-flairs'] === true;
  const style = cfg.style ?? 'vertical-list';
  const title = cfg.title ?? (cfg['source-header'] ? 'Reddit' : undefined);
  const feedItems: FeedItem[] = posts.map((post) => {
    const domain = post.url ? new URL(post.url).hostname.replace(/^www\./, '') : null;
    const age = formatAge(post.ageSeconds);
    const parts = [domain, `${post.score} points`, `${post.comments} comments`, age].filter(Boolean) as string[];
    return {
      title: post.title,
      url: post.url,
      meta: parts.join(' • '),
      image: showThumb ? post.thumbnail ?? undefined : undefined,
      tags: showFlair && post.flair ? [post.flair] : undefined,
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

  if (style === 'horizontal-cards' || style === 'vertical-cards') {
    return (
      <WidgetChrome
        title={title}
        titleUrl={cfg['title-url']}
        hideHeader={cfg['hide-header']}
        cssClass={cfg['css-class']}
        error={error}
        showErrors={cfg['show-errors']}
        isLoading={loading}
      >
        {style === 'vertical-cards' ? (
          <Grid columns={{ minWidth: 150 }} gap={2} className={styles.cards}>
            {posts.map((post) => (
              <Card key={post.url} post={post} showMeta />
            ))}
          </Grid>
        ) : (
          <HStack gap={2} className={`${styles.cards} ${styles.rail}`}>
            {posts.map((post) => (
              <Card key={post.url} post={post} showMeta={false} />
            ))}
          </HStack>
        )}
      </WidgetChrome>
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

registerWidgetComponent('reddit', Reddit);

export default Reddit;
