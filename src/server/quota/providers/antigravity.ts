import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: Antigravity session token; quotaUrl: agy localhost LSP override (e.g. https://localhost:8765)
// Primary: agy HTTPS localhost LSP RetrieveUserQuotaSummary; fallback: fetchJson via quotaUrl
export async function fetchAntigravityUsage(
  auth: { token: string; tokenFile?: string; quotaUrl?: string; baseUrl?: string },
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
  const base = auth.quotaUrl ?? auth.baseUrl ?? 'https://localhost:8765';
  // Try localhost agy LSP endpoint
  try {
    const data = await fetchJson<{ used_percent?: number; usedPercent?: number; plan?: string; quota?: { usedPercent?: number } }>(ctx, `${base}/RetrieveUserQuotaSummary`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    });
    const used = Number(data.quota?.usedPercent ?? data.used_percent ?? data.usedPercent ?? 0);
    return { provider: 'antigravity', plan: data.plan, windows: [{ label: 'quota', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], raw: data };
  } catch {
    throw new Error('antigravity: quota file not found — set quotaUrl or install agy CLI');
  }
}
