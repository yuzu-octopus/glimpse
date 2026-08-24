import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: Vertex/GCP access token; tokenFile: ADC file; quotaUrl: Cloud Monitoring override
// Uses gcloud ADC via Bun.spawn with 10s timeout when token empty
async function gcloudToken(): Promise<string | null> {
  try {
    const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
    if (!bun) return null;
    const proc = bun.spawn(['gcloud', 'auth', 'print-access-token'], { stdout: 'pipe', stderr: 'pipe' });
    const t = setTimeout(() => { try { proc.kill(); } catch {} }, 10_000);
    const text = await new Response(proc.stdout).text();
    clearTimeout(t);
    await proc.exited;
    return proc.exitCode === 0 ? text.trim() : null;
  } catch { return null; }
}

export async function fetchVertexUsage(
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
  if (!token) token = (await gcloudToken()) ?? '';
  if (!token) throw new Error('vertex: quota file not found — set token or install gcloud ADC');
  const base = auth.quotaUrl ?? auth.baseUrl ?? 'https://monitoring.googleapis.com';
  const data = await fetchJson<{ quota?: { usedPercent?: number }; used_percent?: number }>(ctx, `${base}/v3/projects/-/timeSeries:consumer_quota?service=aiplatform.googleapis.com`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const used = Number((data.quota as Record<string, number> | undefined)?.usedPercent ?? data.used_percent ?? 0);
  return { provider: 'vertex', windows: [{ label: 'quota', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], raw: data };
}
