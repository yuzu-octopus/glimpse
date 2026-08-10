import { useLocation } from 'react-router-dom';
import { TopNav as AstryxTopNav, TopNavItem } from '@astryxdesign/core';
import { useConfig } from '../hooks/useConfig';
import { ThemePicker } from './ThemePicker';
import styles from './top-nav.module.css';

// glance docs §Pages & Columns: default 1600px / slim 1100px / wide 1920px.
const NAV_WIDTHS = { default: 1600, slim: 1100, wide: 1920 } as const;

/** Global top navigation: app title, page tabs, theme picker (step 5). */
export function TopNav({ width }: { width?: 'default' | 'slim' | 'wide' }) {
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
      style={
        width
          ? { maxWidth: NAV_WIDTHS[width], marginInline: 'auto' }
          : undefined
      }
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
