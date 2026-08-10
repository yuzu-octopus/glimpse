import { useLocation } from 'react-router-dom';
import { TopNav as AstryxTopNav, TopNavItem } from '@astryxdesign/core';
import { useConfig } from '../hooks/useConfig';
import { ThemePicker } from './ThemePicker';
import styles from './top-nav.module.css';

/** Global top navigation: app title, page tabs, theme picker (step 5). */
export function TopNav() {
  const state = useConfig();
  const config = state.status === 'ready' ? state.config : undefined;
  const { pathname } = useLocation();
  const pages = config?.pages ?? [];
  const homeSlug = pages[0]?.slug;

  const isSelected = (slug: string) =>
    slug === homeSlug ? pathname === '/' || pathname === `/${slug}` : pathname === `/${slug}`;

  return (
    <AstryxTopNav
      heading="Glimpse"
      centerContent={
        <nav className={styles.tabs} aria-label="Pages">
          {pages.map((p) => (
            <TopNavItem
              key={p.slug}
              href={p.slug === homeSlug ? '/' : `/${p.slug}`}
              label={p.name}
              isSelected={isSelected(p.slug)}
            />
          ))}
        </nav>
      }
      endContent={<ThemePicker />}
    />
  );
}
