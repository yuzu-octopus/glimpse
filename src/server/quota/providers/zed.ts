import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: Zed session token (or Cookie value); tokenFile: file containing token
// endpoint: GET https://cloud.zed.dev/client/users/me (Keychain credentials_url)
export async function fetchZedUsage(auth: { token: string; tokenFile?: string }, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  let token = auth.token;
  if (!token && auth.tokenFile) {
    try {
      const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
      if (bun) { const f = bun.file(auth.tokenFile); if (await f.exists()) token = (await f.text()).trim(); }
      else { const { readFile } = await import('node:fs/promises'); token = (await readFile(auth.tokenFile, 'utf8')).trim(); }
    } catch {}
  }
  if (!token) throw new Error('zed: quota file not found — set token or tokenFile to Zed credentials');
  const data = await fetchJson<Record<string, unknown>>(ctx, 'https://cloud.zed.dev/client/users/me', {
    headers: { Authorization: `Bearer ${token}` , 'Accept': 'application/json' },
  });
  const used = Number((data.used_percent as number) ?? (data.usedPercent as number) ?? 0);
  const plan = (data.plan as string) ?? (data.subscription as string);
  return { provider: 'zed', plan, windows: [{ label: 'usage', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], raw: data };
}
