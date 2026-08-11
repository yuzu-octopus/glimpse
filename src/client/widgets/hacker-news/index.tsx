import { Link } from '@astryxdesign/core';
import type { HackerNewsConfig } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useRelativeTime } from '../useRelativeTime';
import type { HnPost } from '../../../server/widgets/hacker-news';
import styles from './hacker-news.module.css';

/** post source host, minus www (glance rss-list shows the channel/domain). */
function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function HnRow({ post }: { post: HnPost }) {
  const age = useRelativeTime(post.ageSeconds);
  const domain = domainOf(post.url);
  return (
    <div className={styles.row}>
      <Link href={post.url} target="_blank" className={styles.title} hasUnderline={false}>
        {post.title}
      </Link>
      <div className={styles.meta}>
        {domain ? <span>{domain}</span> : null}
        {domain ? <span className={styles.sep}>•</span> : null}
        <span>{post.score} points</span>
        <span className={styles.sep}>•</span>
        <Link href={post.commentsUrl} target="_blank" className={styles.metaLink}>
          {post.comments} comments
        </Link>
        <span className={styles.sep}>•</span>
        <span>{age}</span>
      </div>
    </div>
  );
}

function HackerNews({ config, data }: WidgetComponentProps) {
  const cfg = config as unknown as HackerNewsConfig;
  const posts = ((data as { posts?: HnPost[] } | null)?.posts ?? []) as HnPost[];
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      collapseAfter={cfg['collapse-after']}
      items={posts.map((p) => <HnRow key={p.id} post={p} />)}
    />
  );
}

registerWidgetComponent('hacker-news', HackerNews);

export default HackerNews;
