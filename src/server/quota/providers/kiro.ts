import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: unused; tokenFile: kiro auth file path (optional)
// CLI: kiro-cli chat --no-interactive "/usage" with 10s timeout, parse ANSI plan, credits%
export async function fetchKiroUsage(
  _auth: { token: string; tokenFile?: string },
  _ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  try {
    const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
    if (!bun) throw new Error('kiro: quota file not found');
    const proc = bun.spawn(['kiro-cli', 'chat', '--no-interactive', '/usage'], { stdout: 'pipe', stderr: 'pipe' });
    const timer = setTimeout(() => { try { proc.kill(); } catch {} }, 10_000);
    const out = await new Response(proc.stdout).text();
    clearTimeout(timer);
    await proc.exited;
    if (proc.exitCode !== 0) throw new Error('kiro: quota file not found');
    const pct = Number(out.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] ?? 0);
    const plan = out.match(/plan:\s*(\S+)/i)?.[1];
    return { provider: 'kiro', plan, windows: [{ label: 'credits', usedPercent: Math.min(100, pct), windowMinutes: 0, resetsAt: 0 }], raw: { out: out.slice(0, 500) } };
  } catch {
    throw new Error('kiro: quota file not found — install kiro-cli or set tokenFile');
  }
}
