/**
 * Resolve GitHub token from env or `gh` CLI.
 * Industry Bun practice: use `Bun.spawn` with piped stdout, cache the result,
 * and fall back to unauthenticated when neither is available.
 */
let cached: string | null | undefined = undefined; // undefined = not yet tried, null = no token
let pending: Promise<string | undefined> | null = null;

/**
 * Returns a GitHub token if available:
 * 1. `GITHUB_TOKEN` / `GH_TOKEN` from env
 * 2. `gh auth token` (when `gh` is installed and logged in)
 * 3. undefined → caller should send unauthenticated request (60/hr)
 */
export async function getGitHubToken(
  env: Record<string, string | undefined>,
): Promise<string | undefined> {
  if (env.GITHUB_TOKEN) return env.GITHUB_TOKEN;
  if (env.GH_TOKEN) return env.GH_TOKEN;
  if (cached !== undefined) return cached ?? undefined;
  if (pending) return pending;

  pending = (async (): Promise<string | undefined> => {
    try {
      const proc = Bun.spawn(['gh', 'auth', 'token'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      const text = await new Response(proc.stdout).text();
      const code = await proc.exited;
      const token = text.trim();
      if (code === 0 && token) {
        cached = token;
        return token;
      }
    } catch {
      // gh not installed or not logged in — fall through to unauth
    }
    cached = null;
    return undefined;
  })();

  const result = await pending;
  pending = null;
  return result;
}

/** Synchronous check for callers that cannot await (returns env only). */
export function getGitHubTokenSync(
  env: Record<string, string | undefined>,
): string | undefined {
  return env.GITHUB_TOKEN ?? env.GH_TOKEN;
}
