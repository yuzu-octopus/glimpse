import { Link } from '@astryxdesign/core';
import type { RedditConfig } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { formatAge } from '../useRelativeTime';
import type { RedditPost } from '../../../shared/widgets/payloads';
import styles from './reddit.module.css';
import Feed, { type FeedItem } from '../feed/Feed';

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
      <WidgetChrome title={title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={[cfg['css-class'], styles.cards].filter(Boolean).join(' ') || undefined} isLoading={loading} error={error}>
        <div className={style === 'horizontal-cards' ? styles.cardRow : styles.cardCol}>
          {posts.map((post) => (
            <Card key={post.url} post={post} showMeta={style === 'vertical-cards'} />
          ))}
        </div>
      </WidgetChrome>
    );
  }

  const feedItems: FeedItem[] = posts.map((post) => {
    const age = formatAge(post.ageSeconds);
    return {
      title: post.title,
      url: post.url,
      meta: `${post.score} points • ${post.comments} comments • ${age}`,
      image: showThumb ? post.thumbnail : null,
      tags: showFlair && post.flair ? [post.flair] : [],
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
      items={feedItems.map((fi) => (
        <Feed key={fi.url} items={[fi]} />
      ))}
    />
  );
}

registerWidgetComponent('reddit', Reddit);

export default Reddit;
