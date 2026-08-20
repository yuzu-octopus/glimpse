import { useState } from 'react';
import { Link } from '@astryxdesign/core';
import { ChevronRight } from 'lucide-react';
import type { RedditConfig } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { formatAge } from '../useRelativeTime';
import type { RedditPost } from '../../../shared/widgets/payloads';
import styles from './reddit.module.css';
import Feed, { type FeedItem } from '../feed/Feed';
import chromeStyles from '../../components/widget-chrome.module.css';

function Card({ post, showMeta }: { post: RedditPost; showMeta: boolean }) {
  const age = formatAge(post.ageSeconds);
  return (
    <Link key={post.url} href={post.url} target="_blank" className={styles.card} hasUnderline={false}>
      {post.thumbnail ? (
        <img src={post.thumbnail} alt="" loading="lazy" className={styles.cardThumb} />
      ) : (
        <div className={styles.cardThumbPlaceholder} />
      )}
      <span className={styles.cardTitle}>{post.title}</span>
      {showMeta ? (
        <span className={styles.cardMeta}>
          <span>{post.score} points</span>
          <span className={styles.sep}>•</span>
          <span>{age}</span>
        </span>
      ) : null}
    </Link>
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
        isLoading={loading}
      >
        <div className={styles.cards}>
          {posts.map((post) => (
            <Card key={post.url} post={post} showMeta={style === 'vertical-cards'} />
          ))}
        </div>
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

registerWidgetComponent('reddit', Reddit);

export default Reddit;
