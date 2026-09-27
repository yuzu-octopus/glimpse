import { useState } from 'react';
import { Link } from '@astryxdesign/core';
import type { BookmarksConfig } from '../../../shared/widgets/bookmarks';
import { WidgetChrome } from '../../components/WidgetChrome';
import { registerWidgetComponent, type WidgetComponentProps } from '../registry';
import { tagAccent, type TagAccent } from '../feed/tag-accent';
import { resolveIcon } from './icon';
import styles from './bookmarks.module.css';

const ICON_ACCENT_CLASS: Record<TagAccent, string> = {
  green: styles.iconAccentGreen,
  cyan: styles.iconAccentCyan,
  pink: styles.iconAccentPink,
  orange: styles.iconAccentOrange,
};

// The schema admits only these five names, so the mapping is total.
const TITLE_ACCENT_CLASS: Record<NonNullable<BookmarksConfig['groups'][number]['color']>, string> = {
  green: styles.titleAccentGreen,
  cyan: styles.titleAccentCyan,
  yellow: styles.titleAccentYellow,
  orange: styles.titleAccentOrange,
  pink: styles.titleAccentPink,
};

// A bad or unreachable icon URL must cost the icon, not the row: the tile is
// dropped whole so the link keeps its text and the page never paints a
// broken-image glyph.
function BookmarkIcon({ icon, accent }: { icon: string; accent: TagAccent }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const { src, autoInvert } = resolveIcon(icon);
  return (
    <span className={`${styles.iconContainer} ${ICON_ACCENT_CLASS[accent]}`}>
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={autoInvert ? `${styles.icon} ${styles.iconAutoInvert}` : styles.icon}
      />
    </span>
  );
}
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
              <div className={`${styles.groupTitle} ${group.color ? TITLE_ACCENT_CLASS[group.color] : ''}`}>
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
                      <BookmarkIcon icon={link.icon} accent={tagAccent(link.url)} />
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
