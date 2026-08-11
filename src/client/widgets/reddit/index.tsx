import { Link } from '@astryxdesign/core';
import type { RedditConfig } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useRelativeTime } from '../useRelativeTime';
import type { RedditPost } from '../../../server/widgets/reddit';
import styles from './reddit.module.css';

function Row({ post, showThumb, showFlair }: { post: RedditPost; showThumb: boolean; showFlair: boolean }) {
  const age = useRelativeTime(post.ageSeconds);
  return (
    <div className={styles.row}>
      {showThumb && post.thumbnail ? (
        <img src={post.thumbnail} alt="" loading="lazy" className={styles.thumb} />
      ) : null}
      <div className={styles.rowBody}>
        <Link href={post.url} target="_blank" className={styles.title} hasUnderline={false}>
          {post.title}
        </Link>
        <div className={styles.meta}>
          {showFlair && post.flair ? <span className={styles.flair}>{post.flair}</span> : null}
          <span>{post.score} points</span>
          <span className={styles.sep}>•</span>
          <Link href={post.commentsUrl} target="_blank" className={styles.metaLink}>
            {post.comments} comments
          </Link>
          <span className={styles.sep}>•</span>
          <span>{age}</span>
        </div>
      </div>
    </div>
  );
}

function Card({ post, showMeta }: { post: RedditPost; showMeta: boolean }) {
  const age = useRelativeTime(post.ageSeconds);
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

function Reddit({ config, data }: WidgetComponentProps) {
  const cfg = config as unknown as RedditConfig;
  const posts = ((data as { posts?: RedditPost[] } | null)?.posts ?? []) as RedditPost[];
  const showThumb = cfg['show-thumbnails'] === true;
  const showFlair = cfg['show-flairs'] === true;
  const style = cfg.style ?? 'vertical-list';

  if (style === 'horizontal-cards' || style === 'vertical-cards') {
    return (
      <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={[cfg['css-class'], styles.cards].filter(Boolean).join(' ') || undefined}>
        <div className={style === 'horizontal-cards' ? styles.cardRow : styles.cardCol}>
          {posts.map((post) => (
            <Card key={post.url} post={post} showMeta={style === 'vertical-cards'} />
          ))}
        </div>
      </WidgetChrome>
    );
  }

  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      collapseAfter={cfg['collapse-after']}
      items={posts.map((p) => <Row key={p.url} post={p} showThumb={showThumb} showFlair={showFlair} />)}
    />
  );
}

registerWidgetComponent('reddit', Reddit);

export default Reddit;
