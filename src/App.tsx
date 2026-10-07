import { Banner } from "@astryxdesign/core";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import styles from "./app.module.css";
import { MobileNavigation, TopNav } from "./client/components/TopNav";
import { useConfig } from "./client/hooks/useConfig";
import { useStaleNotice } from "./client/hooks/usePageData";
import { PageView } from "./client/pages/PageView";
import type { ResolvedConfig } from "./shared/config";

type PageConfig = ResolvedConfig["pages"][number];

function RoutePage({ page }: { page?: PageConfig }) {
	const { slug } = useParams();
	return <PageView slug={slug ?? ""} page={page} />;
}

/**
 * The dashboard is showing its last known data, not a live reading. Rendered
 * above the page and never in place of it: a warm cache with a dead network
 * is the one state a glance dashboard cannot be allowed to look normal in.
 */
function StaleNotice({ offline }: { offline: boolean }) {
	const notice = useStaleNotice();
	if (!notice) return null;
	return (
		<Banner
			status="warning"
			container="section"
			data-testid="stale-notice"
			title={offline ? "Offline — showing the last known data" : "Showing the last known data"}
			description={notice.reason}
		/>
	);
}

/** `navigator.onLine` is a hint, not a fact, but it is the only one the
 * browser offers and it flips the message from "stale" to "offline". */
function useOnline(): boolean {
	const [online, setOnline] = useState(() => navigator.onLine !== false);
	useEffect(() => {
		const goOnline = () => setOnline(true);
		const goOffline = () => setOnline(false);
		window.addEventListener("online", goOnline);
		window.addEventListener("offline", goOffline);
		return () => {
			window.removeEventListener("online", goOnline);
			window.removeEventListener("offline", goOffline);
		};
	}, []);
	return online;
}

export default function App() {
	const state = useConfig();
	const online = useOnline();
	const { pathname } = useLocation();

	if (state.status === "loading") {
		return (
			<div className={styles.loadingContainer}>
				<div className={styles.loadingIcon} role="status" aria-label="Loading" />
			</div>
		);
	}
	if (state.status === "error") {
		return (
			<div className={styles.loadingContainer}>
				<Banner status="error" title={state.error ?? "Configuration failed to load"} />
			</div>
		);
	}

	const homeSlug = state.config.pages[0].slug;
	// The active page's config drives the nav: `hide-desktop-navigation` hides
	// the TopNav on desktop (kept on mobile), `desktop-navigation-width`
	// constrains its content (glance page props).
	const activeSlug = pathname === "/" ? homeSlug : pathname.slice(1);
	// Unknown slugs (e.g. /nonsense) redirect home instead of rendering the
	// fallback page's skeleton then a "page not found" banner; this also keeps
	// RoutePage from ever receiving an invalid slug.
	if (pathname !== "/" && !state.config.pages.some((p) => p.slug === activeSlug)) {
		return <Navigate to="/" replace />;
	}
	const activePage = state.config.pages.find((p) => p.slug === activeSlug) ?? state.config.pages[0];

	return (
		<>
			<div
				data-testid="top-nav-wrapper"
				className={[
					styles.headerContainer,
					activePage["hide-desktop-navigation"] ? styles.hideDesktopNav : null,
				]
					.filter(Boolean)
					.join(" ")}
			>
				<TopNav width={activePage["desktop-navigation-width"]} />
			</div>
			<MobileNavigation />
			<StaleNotice offline={!online} />
			<main>
				<Routes>
					<Route path="/" element={<PageView slug={homeSlug} page={activePage} />} />
					<Route path="/:slug" element={<RoutePage page={activePage} />} />
				</Routes>
			</main>
			<div className={styles.mobileNavigationOffset} />
		</>
	);
}
