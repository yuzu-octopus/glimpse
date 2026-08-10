import { Route, Routes, useLocation, useParams } from 'react-router-dom';
import { Banner, Center, Spinner } from '@astryxdesign/core';
import { TopNav } from './client/components/TopNav';
import { useConfig } from './client/hooks/useConfig';
import { PageView } from './client/pages/PageView';
import styles from './app.module.css';

function RoutePage() {
  const { slug } = useParams();
  return <PageView slug={slug ?? ''} />;
}

export default function App() {
  const state = useConfig();
  const { pathname } = useLocation();

  if (state.status === 'loading') {
    return (
      <Center minHeight="100vh">
        <Spinner size="lg" />
      </Center>
    );
  }
  if (state.status === 'error') {
    return (
      <Center minHeight="100vh">
        <Banner
          status="error"
          title={state.error ?? 'Configuration failed to load'}
        />
      </Center>
    );
  }

  const homeSlug = state.config.pages[0].slug;
  // The active page's config drives the nav: `hide-desktop-navigation` hides
  // the TopNav on desktop (kept on mobile), `desktop-navigation-width`
  // constrains its content (glance page props).
  const activeSlug = pathname === '/' ? homeSlug : pathname.slice(1);
  const activePage =
    state.config.pages.find((p) => p.slug === activeSlug) ??
    state.config.pages[0];

  return (
    <>
      <div
        data-testid="top-nav-wrapper"
        className={
          activePage['hide-desktop-navigation'] ? styles.hideDesktopNav : undefined
        }
      >
        <TopNav width={activePage['desktop-navigation-width']} />
      </div>
      <main>
        <Routes>
          <Route path="/" element={<PageView slug={homeSlug} />} />
          <Route path="/:slug" element={<RoutePage />} />
        </Routes>
      </main>
    </>
  );
}
