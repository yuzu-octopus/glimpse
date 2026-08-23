import { Link } from '@astryxdesign/core';
import type { BookmarksConfig } from '../../../shared/widgets/bookmarks';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import styles from './bookmarks.module.css';

function Bookmarks({ config }: WidgetComponentProps) {
  const cfg = config as unknown as BookmarksConfig;
  const groups = cfg.groups ?? [];
  if (groups.length === 0) {
    return (
      <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']}>
        <div className={styles.empty}>No bookmark groups configured.</div>
      </WidgetChrome>
    );
  }

  return (
    <WidgetChrome title={cfg.title} titleUrl={cfg['title-url']} hideHeader={cfg['hide-header']} cssClass={cfg['css-class']}>
      {groups.map((group) => {
        const links = group.links ?? [];
        return (
          <div key={`${group.title ?? ''}::${links[0]?.url ?? ''}::${links.length}`} className={styles.group}>
            {group.title ? (
              <div className={styles.groupTitle} style={group.color ? { color: group.color } : undefined}>
                {group.title}
              </div>
            ) : null}
            <ul className={styles.links}>
              {links.map((link) => (
                <li key={`${link.title}::${link.url}::${link.description ?? ''}`} className={styles.linkItem}>
                  <Link
                    href={link.url}
                    target={link['same-tab'] || group['same-tab'] || cfg['same-tab'] ? undefined : '_blank'}
                    className={styles.linkCard}
                    hasUnderline={false}
                  >
                    {link.icon ? (
                      <span className={styles.iconContainer}>
                        <img src={link.icon} alt="" loading="lazy" className={styles.icon} />
                      </span>
                    ) : null}
                    <span className={styles.linkTitle}>{link.title}</span>
                  </Link>
                  {link.description ? <span className={styles.linkDesc}>{link.description}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </WidgetChrome>
  );
}

registerWidgetComponent('bookmarks', Bookmarks);

export default Bookmarks;
