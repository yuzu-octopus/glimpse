import { useState } from 'react';
import { Button, ClickableCard, Grid, HStack, Text } from '@astryxdesign/core';
import { ChevronRight } from 'lucide-react';
import { type RedditConfig } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { formatAge } from '../_hooks/useRelativeTime';
import type { RedditPost } from '../../../shared/widgets/payloads';
import styles from './reddit.module.css';
import Feed, { type FeedItem } from '../feed/feed';

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
        <Text type="body" maxLines={CARD_TITLE_LINES} className={styles.cardTitle}>
          {post.title}
        </Text>
        {showMeta ? <Text type="supporting">{`${post.score} points · ${age}`}</Text> : null}
      </div>
    </ClickableCard>
  );
}

/** Post → feed row. Domain, score, comments and age read as one meta line;
 *  thumbnail and flair are opt-in per config. */
function toFeedItems(
  posts: RedditPost[],
  showThumb: boolean,
  showFlair: boolean,
): FeedItem[] {
  return posts.map((post) => {
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
}

/** glance semantics: only a non-negative `collapse-after` truncates, and only
 *  when there is actually something hidden behind the toggle. `hidden` is the
 *  count the button promises, so the two never disagree. */
function collapseSlice<T>(
  items: T[],
  after: number | undefined,
  expanded: boolean,
): { has: boolean; hidden: number; visible: T[] } {
  const has = typeof after === 'number' && after >= 0 && items.length > after;
  return {
    has,
    hidden: has ? items.length - (after as number) : 0,
    visible: has && !expanded ? items.slice(0, after) : items,
  };
}

function ShowMore({
  expanded,
  hidden,
  onToggle,
}: {
  expanded: boolean;
  hidden: number;
  onToggle: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      label={expanded ? 'Show less' : `Show more (${hidden})`}
      endContent={<ChevronRight size={12} />}
      onClick={onToggle}
    />
  );
}

/** Cards style: a wrapped grid, or one horizontal rail. */
function CardDeck({ posts, style }: { posts: RedditPost[]; style: 'vertical-cards' | 'horizontal-cards' }) {
  return style === 'vertical-cards' ? (
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
  const feedItems = toFeedItems(posts, showThumb, showFlair);
  const [expanded, setExpanded] = useState(false);
  const { has: hasCollapse, hidden, visible } = collapseSlice(
    feedItems,
    cfg['collapse-after'],
    expanded,
  );

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
        <CardDeck posts={posts} style={style} />
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
        <ShowMore
          expanded={expanded}
          hidden={hidden}
          onToggle={() => setExpanded(!expanded)}
        />
      ) : null}
    </WidgetChrome>
  );
}

registerWidgetComponent('reddit', Reddit);

export default Reddit;
