import { LinkProvider } from "@astryxdesign/core/Link";
import { Theme } from "@astryxdesign/core/theme";
import { astryxDraculaTheme } from "astryx-dracula";
import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";

/**
 * One brand theme, dark-only. `astryx-dracula` ships its tokens as an
 * unlayered `:root` block (see astryx-dracula/tokens.css), so the html element
 * resolves every themed var from CSS alone — no runtime token mirroring, no
 * persisted mode/preset, no boot-time paint to keep in sync.
 */

/** Injects the YAML custom-css-file contents (glance appends it last). */
function useCustomCss(): string | null {
	const [css, setCss] = useState<string | null>(null);
	useEffect(() => {
		let cancelled = false;
		fetch("/api/theme")
			.then((r) => {
				if (!r.ok) throw new Error(`HTTP ${r.status}`);
				return r.json() as Promise<{ customCss?: string | null }>;
			})
			.then((body) => {
				if (!cancelled) setCss(body.customCss ?? null);
			})
			.catch(() => {
				if (!cancelled) setCss(null);
			});
		return () => {
			cancelled = true;
		};
	}, []);
	return css;
}

export function GlimpseThemeProvider({ children }: { children: ReactNode }) {
	const customCss = useCustomCss();

	return (
		<>
			<Theme theme={astryxDraculaTheme} mode="dark">
				<LinkProvider component={Link}>{children}</LinkProvider>
			</Theme>
			{customCss ? <style data-glimpse-custom>{customCss}</style> : null}
		</>
	);
}
