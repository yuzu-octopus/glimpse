import { Route, Routes, useParams } from 'react-router-dom';
import { Banner, Center, Spinner } from '@astryxdesign/core';
import { TopNav } from './client/components/TopNav';
import { useConfig } from './client/hooks/useConfig';
import { PageView } from './client/pages/PageView';

function RoutePage() {
  const { slug } = useParams();
  return <PageView slug={slug ?? ''} />;
}

export default function App() {
  const state = useConfig();

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
  return (
    <>
      <TopNav />
      <main>
        <Routes>
          <Route path="/" element={<PageView slug={homeSlug} />} />
          <Route path="/:slug" element={<RoutePage />} />
        </Routes>
      </main>
    </>
  );
}
