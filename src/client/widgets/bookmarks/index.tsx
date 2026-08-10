import { Link } from '@astryxdesign/core';
import { ArrowUpRight } from 'lucide-react';
import { bookmarksSchema } from '../../../shared/widgets/bookmarks';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './bookmarks.module.css';

function Bookmarks({ config }: WidgetComponentProps) {
  const cfg = bookmarksSchema.parse(config);
  const groups = cfg.groups ?? [];
  if (groups.length === 0) return <WidgetChrome title={cfg.title} hideHeader={cfg['hide-header']}><div className={styles.empty}>No bookmark groups configured.</div></WidgetChrome>;

  return (
    <WidgetChrome title={cfg.title} hideHeader={cfg['hide-header']}>
      {groups.map((group, i) => (
        <div key={group.title ?? `group-${i}`} className={styles.group}>
          {group.title ? (
            <div className={styles.groupTitle}>
              {group.color ? (
                <span className={styles.groupDot} style={{ backgroundColor: group.color }} />
              ) : null}
              {group.title}
            </div>
          ) : null}
          <div className={styles.links}>
            {group.links.map((link, j) => (
              <Link
                key={`${link.title}-${j}`}
                href={link.url}
                target={link['same-tab'] || group['same-tab'] || cfg['same-tab'] ? undefined : '_blank'}
                className={styles.linkRow}
                hasUnderline={false}
              >
                <span className={styles.linkTitle}>{link.title}</span>
                {link.description ? <span className={styles.linkDesc}>{link.description}</span> : null}
                {!(link['hide-arrow'] ?? group['hide-arrow'] ?? cfg['hide-arrow']) && (
                  <ArrowUpRight size={13} className={styles.arrow} />
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </WidgetChrome>
  );
}

registerWidgetComponent('bookmarks', Bookmarks);
