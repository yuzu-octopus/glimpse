import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, TopNavItem } from '@astryxdesign/core';
import { Menu } from 'lucide-react';
import { prefetchPage } from '../hooks/usePageData';
import { useConfig } from '../hooks/useConfig';
import { PAGE_WIDTHS } from '../../shared/config';
import { SettingsPanel } from './SettingsPanel';
import styles from './top-nav.module.css';

function useNavPages() {
  const state = useConfig();
  const { pathname } = useLocation();
  const pages = state.status === 'ready' ? state.config.pages : [];
  const homeSlug = pages[0]?.slug;
  const isSelected = (slug: string) =>
    slug === homeSlug ? pathname === '/' || pathname === `/${slug}` : pathname === `/${slug}`;
  return { pages, homeSlug, isSelected };
}

/** Desktop header: glance's widget-frame bar (logo + page tabs + settings,
 * height 45px). The nav element carries the content-bounds width so
 * the whole bar constrains like glance's header-container.
 *
 * The page links are kit TopNavItems — the current-page state, the hover
 * wash and the focus ring are theirs, and the router link comes from
 * GlimpseThemeProvider's LinkProvider. The logo stays a real <a>: it is a
 * real outbound link, not an action, so it must never become a Button. */
export function TopNav({ width }: { width?: 'default' | 'slim' | 'wide' }) {
  const { pages, homeSlug, isSelected } = useNavPages();
  return (
    <nav
      aria-label="Pages"
      className={styles.header}
      style={
        width ? { maxWidth: PAGE_WIDTHS[width], marginInline: 'auto' } : undefined
      }
    >
      <a
        href="https://github.com/yuzu-octopus/glimpse"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.logoLink}
        aria-label="Glimpse on GitHub (opens in new tab)"
      >
        <img
          src="/icon.svg"
          alt=""
          width={22}
          height={22}
          className={styles.logoIcon}
        />
        <span className={styles.logoText}>Glimpse</span>
      </a>
      <div className={styles.navLinks}>
        {pages.map((p) => (
          <TopNavItem
            key={p.slug}
            label={p.name}
            href={p.slug === homeSlug ? '/' : `/${p.slug}`}
            isSelected={isSelected(p.slug)}
            onMouseEnter={() => prefetchPage(p.slug)}
            onFocus={() => prefetchPage(p.slug)}
          />
        ))}
      </div>
      <SettingsPanel />
    </nav>
  );
}

/** Mobile bottom bar (glance mobile-navigation): icons row with the
 * expandable page-links list; shown <768px, hidden on desktop via CSS. */
export function MobileNavigation() {
  const { pages, homeSlug, isSelected } = useNavPages();
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={styles.mobileNav} data-testid="mobile-navigation">
      <div className={styles.mobileNavIcons}>
        <Button
          label="Pages"
          isIconOnly
          icon={<Menu size={18} aria-hidden="true" />}
          variant="ghost"
          className={styles.mobileNavToggle}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        />
        <SettingsPanel />
      </div>
      {expanded ? (
        <div className={styles.mobileNavLinks}>
          {pages.map((p) => (
            <TopNavItem
              key={p.slug}
              label={p.name}
              href={p.slug === homeSlug ? '/' : `/${p.slug}`}
              isSelected={isSelected(p.slug)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
