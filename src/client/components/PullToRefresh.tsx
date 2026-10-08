import { Loader2 } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import styles from "./pull-to-refresh.module.css";

/** Drag distance (px) past which releasing triggers the refresh. */
const THRESHOLD = 72;
/** Hard cap on how far the indicator can be dragged, so the pull can't run away. */
const MAX_PULL = 110;
/** How far the indicator travels while the refresh is in flight. */
const HOLD = 56;

/**
 * Touch-only pull-to-refresh. Engages only when the document is already at the
 * top and the gesture is downward, so it never fights normal scrolling; once
 * engaged it `preventDefault`s so the rubber-banded indicator moves with the
 * finger instead of the page. Releasing past the threshold calls `onRefresh`
 * and holds the indicator until that promise settles.
 *
 * Desktop is untouched by construction: `touchstart` only fires from a real
 * touch surface, so a mouse drag never triggers a refresh.
 */
export function PullToRefresh({
	onRefresh,
	children,
}: {
	onRefresh: () => Promise<void>;
	children: ReactNode;
}) {
	const [pull, setPull] = useState(0);
	const [refreshing, setRefreshing] = useState(false);
	const startYRef = useRef<number | null>(null);
	const engagedRef = useRef(false);
	const refreshingRef = useRef(false);
	const onRefreshRef = useRef(onRefresh);

	// Keep the latest callback without re-binding the listeners every render.
	useEffect(() => {
		onRefreshRef.current = onRefresh;
	}, [onRefresh]);

	const atTop = useCallback(() => (window.scrollY || document.documentElement.scrollTop) <= 0, []);
	// The live pull distance, written by touchmove and read by touchend. A ref
	// (not the state value) because React batches the moves: by touchend the
	// state has not necessarily re-rendered, so reading `pull` there would lag
	// one frame behind the finger.
	const pullRef = useRef(0);

	useEffect(() => {
		const onTouchStart = (e: TouchEvent) => {
			if (refreshingRef.current || !atTop() || e.touches.length !== 1) return;
			startYRef.current = e.touches[0].clientY;
			engagedRef.current = false;
		};

		const onTouchMove = (e: TouchEvent) => {
			if (refreshingRef.current) return;
			const startY = startYRef.current;
			if (startY === null || e.touches.length !== 1) return;

			const delta = e.touches[0].clientY - startY;
			// Upward, or the page has scrolled away from the top: not our gesture.
			if (delta <= 0 || !atTop()) {
				if (engagedRef.current) {
					engagedRef.current = false;
					setPull(0);
				}
				return;
			}

			// Past a small slop we own the gesture; suppressing the native
			// overscroll here is what lets the indicator track the finger.
			if (!engagedRef.current && delta > 8) engagedRef.current = true;
			if (!engagedRef.current) return;

			if (e.cancelable) e.preventDefault();
			// Rubber-band: the further past the threshold, the less it follows.
			const resisted = Math.min(MAX_PULL, delta * 0.55);
			pullRef.current = resisted;
			setPull(resisted);
		};

		const onTouchEnd = () => {
			if (refreshingRef.current) return;
			const shouldRefresh = engagedRef.current && pullRef.current >= THRESHOLD;
			startYRef.current = null;
			engagedRef.current = false;
			pullRef.current = 0;

			if (!shouldRefresh) {
				setPull(0);
				return;
			}

			refreshingRef.current = true;
			setRefreshing(true);
			setPull(HOLD);
			void onRefreshRef
				.current()
				.catch(() => {})
				.finally(() => {
					refreshingRef.current = false;
					setRefreshing(false);
					setPull(0);
				});
		};

		window.addEventListener("touchstart", onTouchStart, { passive: true });
		window.addEventListener("touchmove", onTouchMove, { passive: false });
		window.addEventListener("touchend", onTouchEnd, { passive: true });
		window.addEventListener("touchcancel", onTouchEnd, { passive: true });
		return () => {
			window.removeEventListener("touchstart", onTouchStart);
			window.removeEventListener("touchmove", onTouchMove);
			window.removeEventListener("touchend", onTouchEnd);
			window.removeEventListener("touchcancel", onTouchEnd);
		};
	}, [atTop]);

	const visible = pull > 0;
	return (
		<>
			<div
				className={styles.indicator}
				data-testid="pull-indicator"
				data-refreshing={refreshing || undefined}
				style={{
					transform: `translate(-50%, ${pull - HOLD}px)`,
					opacity: visible ? 1 : 0,
				}}
				aria-hidden={!visible}
			>
				<Loader2
					size={18}
					className={refreshing ? styles.spinner : undefined}
					style={refreshing ? undefined : { transform: `rotate(${Math.min(180, pull * 2.5)}deg)` }}
				/>
			</div>
			<div className={styles.content} style={{ transform: `translateY(${pull}px)` }}>
				{children}
			</div>
		</>
	);
}
