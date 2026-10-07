import { useLayoutEffect, useRef, useSyncExternalStore } from "react";

const TICK_MS = 60_000;
const listeners = new Set<() => void>();
/** The wall clock at the last tick — a snapshot for `useSyncExternalStore`,
 *  which needs a referentially stable value between renders, never a counter:
 *  a counter is precisely what a throttled tab gets wrong. */
let lastTickAt = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function publish(): void {
	lastTickAt = Date.now();
	listeners.forEach((l) => {
		l();
	});
}

/** A hidden tab's interval is throttled to a crawl or frozen outright, so
 *  ticks stop while the clock does not. Reconcile the moment the tab is back
 *  instead of waiting for the next tick to notice. */
function onVisibilityChange(): void {
	if (!document.hidden) publish();
}

/** Single shared 60s ticker for the whole page: starts on first subscriber, stops on last. */
function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	if (timer === null) {
		timer = setInterval(publish, TICK_MS);
		document.addEventListener("visibilitychange", onVisibilityChange);
	}
	return () => {
		listeners.delete(listener);
		if (listeners.size === 0 && timer !== null) {
			clearInterval(timer);
			timer = null;
			document.removeEventListener("visibilitychange", onVisibilityChange);
		}
	};
}

function getSnapshot(): number {
	return lastTickAt;
}

/** Re-render once per shared 60s tick (and on tab return); returns the wall
 *  clock of the last tick, for callers that only need the re-render. */
export function useNow(): number {
	return useSyncExternalStore(subscribe, getSnapshot);
}

/** "5m ago" style relative time, derived from the wall clock.
 *
 *  `ageSeconds` is the caller's own reading. A caller that measures per render
 *  hands over a fresh one every time and this is a formatter; a caller that
 *  measures once and memoises it (`useAge`) hands over the same number for the
 *  widget's whole life, so the hook charges the time that has really passed
 *  since it first saw that number. Charging *ticks* instead — the obvious
 *  `+ ticks * 60` — is the bug this replaced: a backgrounded tab is throttled,
 *  so it gets far fewer ticks than minutes, and every age on the page comes
 *  back wrong by however long the tab was hidden. Same derivation as the timer
 *  widget's `advance`: elapsed time, never tick counts.
 *
 *  The anchor is written in a layout effect and *read* during render, the same
 *  discipline `useSyncExternalStore` uses for its snapshot: state established
 *  at commit, read as an input to the next pure render. Writing it in the
 *  render body instead would make the value depend on renders React may
 *  throw away — an anchor recorded for a base that never reached the screen
 *  would be charged elapsed time on the next real render, and the side effect
 *  would run twice per render under StrictMode. */
export function useRelativeTime(ageSeconds: number): string {
	useNow();
	const anchor = useRef<{ age: number; at: number } | null>(null);
	const seen = anchor.current;
	// A caller that re-measures per render has already counted that time
	// itself, so it gets the plain formatter and nothing is charged. Falling
	// back to the previous anchor's elapsed here instead would be a stale-base
	// flash: the new reading rendered on top of the old anchor's minutes.
	const elapsed =
		seen !== null && seen.age === ageSeconds ? Math.max(0, Date.now() - seen.at) / 1000 : 0;

	useLayoutEffect(() => {
		// Re-anchor on the base that is now on screen, stamped at commit time and
		// not at render time: the charge can start no earlier than the moment the
		// value was painted, so a render React discards can never leave an anchor
		// running ahead of what the user was shown. Layout rather than passive
		// effect so no render can slip between the commit and the stamp.
		if (anchor.current === null || anchor.current.age !== ageSeconds) {
			anchor.current = { age: ageSeconds, at: Date.now() };
		}
	}, [ageSeconds]);

	// A clock that steps backwards — an NTP correction, a resumed machine, a
	// user edit — must never walk an age into the future. That is the
	// Math.max(0) on the elapsed charge above.
	return formatAge(ageSeconds + elapsed);
}

export function formatAge(totalSeconds: number): string {
	const s = Math.floor(Math.max(0, totalSeconds));
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h`;
	return `${Math.floor(h / 24)}d`;
}
