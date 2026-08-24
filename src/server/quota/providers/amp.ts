import { readFile } from 'node:fs/promises';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// tokenFile: Amp local session file; token: optional bearer
// CLI: amp usage with 10s timeout, parse percent
export async function fetchAmpUsage(
  auth: { token: string; tokenFile?: string },
  _ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  if (auth.tokenFile) {
    try {
      const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
      const text = bun ? await (async () => { const f = bun.file(auth.tokenFile!); return await f.exists() ? f.text() : ''; })() : await readFile(auth.tokenFile, 'utf8').catch(() => '');
      if (text) {
        const used = Number(text.match(/used_percent["\s:]+(\d+(?:\.\d+)?)/i)?.[1] ?? text.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] ?? 0);
        if (used) return { provider: 'amp', windows: [{ label: 'usage', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], raw: { text: text.slice(0, 500) } };
      }
    } catch {}
  }
  try {
    const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
    if (!bun) throw new Error('amp: quota file not found');
    const proc = bun.spawn(['amp', 'usage'], { stdout: 'pipe', stderr: 'pipe' });
    const timer = setTimeout(() => { try { proc.kill(); } catch {} }, 10_000);
    const out = await new Response(proc.stdout).text();
    clearTimeout(timer);
    await proc.exited;
    if (proc.exitCode === 0) {
      const pct = Number(out.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] ?? 0);
      return { provider: 'amp', windows: [{ label: 'usage', usedPercent: Math.min(100, pct), windowMinutes: 0, resetsAt: 0 }], raw: { out: out.slice(0, 500) } };
    }
  } catch {}
  throw new Error('amp: quota file not found — install amp CLI or set tokenFile');
}
