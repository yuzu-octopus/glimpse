import { Link } from '@astryxdesign/core';
import type { LobstersConfig } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useRelativeTime } from '../useRelativeTime';
import type { LobsterPost } from '../../../shared/widgets/payloads';
import styles from './lobsters.module.css';

/** post source host, minus www (glance rss-list shows the channel/domain). */
function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function LobstersRow({ post }: { post: LobsterPost }) {
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

function Lobsters({ config, data, error, isLoading }: WidgetComponentProps) {
  const cfg = config as unknown as LobstersConfig;
  const loading = isLoading ?? ((data as unknown) == null && !error);
  const posts = ((data as { posts?: LobsterPost[] } | null)?.posts ?? []) as LobsterPost[];
  const title = cfg.title ?? (cfg['source-header'] ? 'Lobsters' : undefined);
  return (
    <WidgetChrome
      title={title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      cssClass={cfg['css-class']}
      collapseAfter={cfg['collapse-after']}
      isLoading={loading}
      error={error}
      items={posts.map((p) => <LobstersRow key={p.id} post={p} />)}
    />
  );
}

registerWidgetComponent('lobsters', Lobsters);

export default Lobsters;
