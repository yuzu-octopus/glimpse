export const apiConfigPattern = ({ url }: { url: URL }): boolean => url.pathname === "/api/config";

export const apiPagePattern = ({ url }: { url: URL }): boolean =>
	url.pathname.startsWith("/api/page/") && !url.searchParams.has("stream");

export const apiThemePattern = ({ url }: { url: URL }): boolean => url.pathname === "/api/theme";
