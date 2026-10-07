import { REPOSITORY_DEFAULTS, repositorySchema } from "../../shared/widgets/keyed";
import type { RepoCommit, RepoPull } from "../../shared/widgets/payloads";
import { getGitHubToken } from "../github-token";
import { fetchJson, retryOptionsFrom } from "./http";
import { registerWidget } from "./registry";

interface GitHubRepo {
	full_name?: string;
	description?: string | null;
	stargazers_count?: number;
	html_url?: string;
}

interface GitHubIssueLike {
	number?: number;
	title?: string;
	html_url?: string;
	pull_request?: unknown;
}

interface GitHubCommit {
	sha?: string;
	html_url?: string;
	commit?: {
		message?: string;
		author?: { name?: string; date?: string } | null;
	};
}

/** glance widget-repository.go:226 splits the message on the first blank
 * line, so a commit body never crowds out its subject. */
function mapCommit(c: GitHubCommit): RepoCommit {
	return {
		sha: (c.sha ?? "").slice(0, 7),
		message: (c.commit?.message ?? "").split("\n\n", 1)[0],
		author: c.commit?.author?.name ?? "",
		date: c.commit?.author?.date ?? null,
		url: c.html_url ?? "",
	};
}

function mapIssue(p: GitHubIssueLike): RepoPull {
	return {
		number: p.number ?? 0,
		title: p.title ?? "",
		url: p.html_url ?? "",
	};
}

registerWidget("repository", async (ctx, config) => {
	const cfg = repositorySchema.parse(config);
	const retry = retryOptionsFrom(cfg);
	const base = `https://api.github.com/repos/${cfg.repository}`;
	const token = await getGitHubToken(ctx.env);
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		"User-Agent": "glimpse/1.0",
		...(token ? { Authorization: `Bearer ${token}` } : {}),
	};

	const [repo, pulls, issues, commits] = await Promise.all([
		fetchJson<GitHubRepo>(ctx, base, { headers }, retry),
		fetchJson<GitHubIssueLike[]>(
			ctx,
			`${base}/pulls?state=open&per_page=${cfg["pull-requests-limit"] ?? REPOSITORY_DEFAULTS["pull-requests-limit"]}`,
			{ headers },
			retry,
		),
		fetchJson<GitHubIssueLike[]>(
			ctx,
			`${base}/issues?state=open&per_page=${cfg["issues-limit"] ?? REPOSITORY_DEFAULTS["issues-limit"]}`,
			{ headers },
			retry,
		),
		// glance defaults commits-limit to -1 ("show none"), so the fourth
		// request only exists for a config that asked for commits.
		(cfg["commits-limit"] ?? REPOSITORY_DEFAULTS["commits-limit"]) > 0
			? fetchJson<GitHubCommit[]>(
					ctx,
					`${base}/commits?per_page=${cfg["commits-limit"]}`,
					{ headers },
					retry,
				)
			: Promise.resolve([] as GitHubCommit[]),
	]);
	return {
		name: repo.full_name ?? cfg.repository,
		description: repo.description ?? null,
		stars: repo.stargazers_count ?? null,
		url: repo.html_url ?? `https://github.com/${cfg.repository}`,
		pulls: pulls.map(mapIssue),
		issues: issues.flatMap((i) => ("pull_request" in i ? [] : [mapIssue(i)])),
		commits: commits.map(mapCommit),
	};
});
