import { readFile } from 'node:fs/promises';
import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: xAI API key or Grok session token; tokenFile: ~/.grok/auth.json
export async function fetchGrokUsage(
  auth: { token: string; tokenFile?: string; baseUrl?: string; quotaUrl?: string },
  ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  const readToken = async (path: string): Promise<string> => {
    try {
      const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
      const text = bun ? await (async () => { const f = bun.file(path); return await f.exists() ? f.text() : ''; })() : await readFile(path, 'utf8').catch(() => '');
      if (!text) return '';
      const j: unknown = JSON.parse(text);
      if (j && typeof j === 'object' && 'token' in j) return String((j as Record<string, unknown>).token ?? '');
      if (j && typeof j === 'object' && 'access_token' in j) return String((j as Record<string, unknown>).access_token ?? '');
    } catch {}
    return '';
  };
  let token = auth.token || (auth.tokenFile ? await readToken(auth.tokenFile) : '') || (await readToken(`${process.env.HOME ?? ''}/.grok/auth.json`));
  // API quota endpoint first
  if (token) {
    try {
      const base = auth.quotaUrl ?? auth.baseUrl ?? 'https://api.x.ai';
      const data = await fetchJson<{ used_percent?: number; usedPercent?: number; plan?: string }>(ctx, `${base}/v1/billing`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const used = Number(data.used_percent ?? data.usedPercent ?? 0);
      if (used || data.plan) return { provider: 'grok', plan: data.plan, windows: [{ label: 'quota', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], raw: data };
    } catch { /* fall through to CLI probe */ }
  }
  // CLI probe: grok agent stdio JSON-RPC x.ai/billing with 10s timeout
  try {
    const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
    if (!bun) throw new Error('grok: quota file not found');
    const proc = bun.spawn(['grok', 'agent', 'stdio'], { stdout: 'pipe', stdin: 'pipe', stderr: 'pipe' });
    const timer = setTimeout(() => { try { proc.kill(); } catch {} }, 10_000);
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'x.ai/billing' }) + '\n');
    proc.stdin.end();
    const out = await new Response(proc.stdout).text();
    clearTimeout(timer);
    await proc.exited;
    const used = Number(out.match(/"used_percent"\s*:\s*(\d+(?:\.\d+)?)/)?.[1] ?? 0);
    if (proc.exitCode === 0 && used) return { provider: 'grok', windows: [{ label: 'quota', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], raw: { out: out.slice(0, 500) } };
  } catch {}
  throw new Error('grok: quota file not found — set token or tokenFile or install grok CLI');
}
