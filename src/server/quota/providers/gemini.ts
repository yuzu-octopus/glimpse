import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: GEMINI_API_KEY or Google OAuth access token; tokenFile: gcloud ADC file
// quotaUrl: override for generativelanguage host
// Uses Bun.spawn(['gcloud','auth','print-access-token']) with 10s timeout when token missing
async function gcloudAccessToken(): Promise<string | null> {
  try {
    const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
    if (!bun) return null;
    const proc = bun.spawn(['gcloud', 'auth', 'print-access-token'], { stdout: 'pipe', stderr: 'pipe' });
    const timer = setTimeout(() => { try { proc.kill(); } catch {} }, 10_000);
    const text = await new Response(proc.stdout).text();
    clearTimeout(timer);
    await proc.exited;
    if (proc.exitCode === 0) return text.trim();
    return null;
  } catch { return null; }
}

export async function fetchGeminiUsage(
  auth: { token: string; tokenFile?: string; baseUrl?: string; quotaUrl?: string },
  ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  let token = auth.token;
  if (!token && auth.tokenFile) {
    try {
      const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
      if (bun) {
        const f = bun.file(auth.tokenFile);
        if (await f.exists()) token = (await f.text()).trim();
      } else {
        const { readFile } = await import('node:fs/promises');
        token = (await readFile(auth.tokenFile, 'utf8')).trim();
      }
    } catch {}
  }
  if (!token) token = (await gcloudAccessToken()) ?? '';
  if (!token) throw new Error('gemini: quota file not found — set token or install gcloud ADC');
  const base = auth.quotaUrl ?? auth.baseUrl ?? 'https://generativelanguage.googleapis.com';
  const data = await fetchJson<{ quota?: { usedPercent?: number }; used_percent?: number; plan?: string }>(ctx, `${base}/v1beta/quota`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const used = Number(data.quota?.usedPercent ?? data.used_percent ?? 0);
  return { provider: 'gemini', plan: data.plan, windows: [{ label: 'quota', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], raw: data };
}
