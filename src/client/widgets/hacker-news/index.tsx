import { Link } from '@astryxdesign/core';
import { hackerNewsSchema } from '../../../shared/widgets/feeds';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { useRelativeTime } from '../useRelativeTime';
import type { HnPost } from '../../../server/widgets/hacker-news';
import common from '../common.module.css';

function HnRow({ post }: { post: HnPost }) {
  const age = useRelativeTime(post.ageSeconds);
  return (
    <div className={common.row}>
      <Link href={post.url} target="_blank" className={common.rowTitle} hasUnderline={false}>
        {post.title}
      </Link>
      <div className={common.meta}>
        <span>{post.score} points</span>
        <span>·</span>
        <Link href={post.commentsUrl} target="_blank" className={common.meta}>
          {post.comments} comments
        </Link>
        <span>·</span>
        <span>{age}</span>
      </div>
    </div>
  );
}

function HackerNews({ config, data }: WidgetComponentProps) {
  const cfg = hackerNewsSchema.parse(config);
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
