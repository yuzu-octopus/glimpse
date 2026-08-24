import { networkSchema, NETWORK_DEFAULTS } from '../../shared/widgets/network';
import type { NetworkData } from '../../shared/widgets/payloads';
import { fetchJson } from './http';
import { registerWidget } from './registry';
import * as os from 'node:os';

function localIp(): string {
  const ifs = os.networkInterfaces();
  for (const addrs of Object.values(ifs)) {
    if (!addrs) continue;
    for (const a of addrs) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return '—';
}

registerWidget('network', async (ctx, cfg) => {
  const c = networkSchema.parse(cfg);
  const showPublic = (c as Record<string, unknown>)['public-ip'] as boolean | undefined ?? NETWORK_DEFAULTS.publicIp;
  const pingTarget = (c as Record<string, unknown>)['ping-target'] as string | undefined ?? NETWORK_DEFAULTS.pingTarget;

  let publicIp: string | null = null;
  if (showPublic) {
    try {
      const j = await fetchJson<{ ip?: string }>(ctx, 'https://api.ipify.org?format=json');
      publicIp = j.ip ?? null;
    } catch {
      publicIp = null;
    }
  }

  let pingMs: number | null = null;
  try {
    const start = Date.now();
    await ctx.fetch(`https://${pingTarget}/`, { method: 'HEAD', signal: AbortSignal.timeout(3000) } as RequestInit).then((r: Response) => r.text().catch(() => {}));
    pingMs = Date.now() - start;
  } catch {
    pingMs = null;
  }

  const data: NetworkData = { localIp: localIp(), publicIp, pingMs };
  return data;
});
