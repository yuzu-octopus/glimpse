import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: Augment API token; tokenFile: file containing token
export async function fetchAugmentUsage(
  auth: { token: string; tokenFile?: string; baseUrl?: string; quotaUrl?: string },
  ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  let token = auth.token;
  if (!token && auth.tokenFile) {
    try {
      const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
      if (bun) { const f = bun.file(auth.tokenFile); if (await f.exists()) token = (await f.text()).trim(); }
      else { const { readFile } = await import('node:fs/promises'); token = (await readFile(auth.tokenFile, 'utf8')).trim(); }
    } catch {}
  }
  if (!token) throw new Error('augment: quota file not found — set token or tokenFile');
  const base = auth.quotaUrl ?? auth.baseUrl ?? 'https://api.augmentcode.com';
  const data = await fetchJson<{ used_percent?: number; usedPercent?: number; plan?: string }>(ctx, `${base}/v1/usage`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const used = Number(data.used_percent ?? data.usedPercent ?? 0);
  return { provider: 'augment', plan: data.plan, windows: [{ label: 'usage', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], raw: data };
}
