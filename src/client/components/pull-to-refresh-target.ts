export function isInnerScrollerTarget(target: EventTarget | null): boolean {
	let node: Element | null = target instanceof Element ? target : null;
	while (node && node !== document.body && node !== document.documentElement) {
		if (node.tagName === "DIALOG") return true;
		const style = getComputedStyle(node);
		const canScrollY =
			(style.overflowY === "auto" || style.overflowY === "scroll") &&
			node.scrollHeight > node.clientHeight;
		const canScrollX =
			(style.overflowX === "auto" || style.overflowX === "scroll") &&
			node.scrollWidth > node.clientWidth;
		if (canScrollY || canScrollX) return true;
		node = node.parentElement;
	}
	return false;
}
