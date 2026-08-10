import { Link } from '@astryxdesign/core';
import { lobstersSchema } from '../../../shared/widgets/keyed';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useRelativeTime } from '../useRelativeTime';
import type { LobsterPost } from '../../../server/widgets/lobsters';
import styles from './lobsters.module.css';

function LobstersRow({ post }: { post: LobsterPost }) {
  const age = useRelativeTime(post.ageSeconds);
  return (
    <div className={styles.row}>
      <Link href={post.url} target="_blank" className={styles.title} hasUnderline={false}>
        {post.title}
      </Link>
      <div className={styles.meta}>
        <span>{post.score} points</span>
        <span>·</span>
        <Link href={post.commentsUrl} target="_blank" className={styles.metaLink}>
          {post.comments} comments
        </Link>
        <span>·</span>
        <span>{age}</span>
      </div>
    </div>
  );
}

function Lobsters({ config, data }: WidgetComponentProps) {
  const cfg = lobstersSchema.parse(config);
  const posts = ((data as { posts?: LobsterPost[] } | null)?.posts ?? []) as LobsterPost[];
  return (
    <WidgetChrome
      title={cfg.title}
      titleUrl={cfg['title-url']}
      hideHeader={cfg['hide-header']}
      collapseAfter={cfg['collapse-after']}
      items={posts.map((p) => <LobstersRow key={p.id} post={p} />)}
    />
  );
}

registerWidgetComponent('lobsters', Lobsters);

export default Lobsters;
