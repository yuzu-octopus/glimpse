import { readFile } from 'node:fs/promises';
import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { RateWindow, UsageSnapshot } from '../../../shared/widgets/quota-types';
import { webFetchJson } from './web';

export interface ProviderAuth {
  token: string;
  accountId?: string;
  projectId?: string;
  baseUrl?: string;
  quotaUrl?: string;
  tokenFile?: string;
}

export type TableAuth = 'bearer' | 'cookie' | 'file' | 'none';

export interface SnapshotBody {
  windows: RateWindow[];
  balance?: number;
  plan?: string;
  raw?: unknown;
}

export interface TableRow {
  id: string;
  url?: string;
  base?: string;
  auth?: TableAuth;
  headers?: Record<string, string>;
  optionalToken?: boolean;
  missing?: string;
  fetchFail?: string;
  /** Per-row `(data: T) => SnapshotBody` with a concrete JSON shape; erased so one registry holds all rows. */
  map?: unknown;
  run?: (auth: ProviderAuth, ctx: WidgetFetchContext) => Promise<UsageSnapshot>;
}

async function readTokenFile(path?: string): Promise<string> {
  if (!path) return '';
  try {
    const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
    if (bun) {
      const f = bun.file(path);
      return (await f.exists()) ? (await f.text()).trim() : '';
    }
    return (await readFile(path, 'utf8').catch(() => '')).trim();
  } catch {
    return '';
  }
}

function mapRow(row: TableRow, data: unknown): SnapshotBody {
  // Single boundary cast: each row declares its own concrete JSON shape at its
  // definition site; the table erases it so 60 shapes share one registry + fetcher.
  const fn = row.map as unknown as (data: unknown) => SnapshotBody;
  return fn(data);
}

export async function fetchTableRow(row: TableRow, auth: ProviderAuth, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  if (row.run) return row.run(auth, ctx);
  if (!row.map) throw new Error(`provider ${row.id} has no map or run`);
  const url = (row.url ?? '').replace('{base}', auth.quotaUrl ?? auth.baseUrl ?? row.base ?? '');
  if (row.auth === 'file') {
    const text = await readTokenFile(auth.tokenFile);
    if (!text) throw new Error(row.missing ?? `${row.id}: quota file not found`);
    const snap = mapRow(row, text);
    return { raw: text, ...snap, provider: row.id };
  }
  if (row.auth === 'cookie') {
    const data = await webFetchJson<unknown>(ctx, url, auth.token);
    const snap = mapRow(row, data);
    return { raw: data, ...snap, provider: row.id };
  }
  const token = row.auth === 'none' ? '' : auth.token || (await readTokenFile(auth.tokenFile));
  if (!token && row.auth === 'bearer' && !row.optionalToken) {
    throw new Error(row.missing ?? `${row.id}: quota file not found`);
  }
  try {
    const data =
      row.auth === 'none'
        ? await fetchJson<unknown>(ctx, url, { headers: { ...(row.headers ?? {}) } })
        : await fetchJson<unknown>(ctx, url, {
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(row.headers ?? {}) },
          });
    const snap = mapRow(row, data);
    return { raw: data, ...snap, provider: row.id };
  } catch (e) {
    if (row.fetchFail) throw new Error(row.fetchFail);
    throw e;
  }
}

export function tableRow(id: string): TableRow {
  const row = PROVIDER_TABLE.find((r) => r.id === id);
  if (!row) throw new Error(`provider ${id} not in table`);
  return row;
}

// Shared maps for alias rows (same endpoint/shape, provider id comes from the row).
const groqMap = (data: { balance: number; limit?: number; used?: number }): SnapshotBody => {
  const limit = data.limit ?? 100;
  const used = data.used ?? limit - data.balance;
  return {
    windows: [{ label: 'credits', usedPercent: Math.min(100, (used / limit) * 100), windowMinutes: 0, resetsAt: 0 }],
    balance: data.balance,
  };
};
const clineMap = (data: { remaining: number; total: number }): SnapshotBody => ({
  windows: [
    {
      label: 'credits',
      usedPercent: Math.min(100, ((data.total - data.remaining) / data.total) * 100),
      windowMinutes: 0,
      resetsAt: 0,
    },
  ],
  balance: data.remaining,
});
const factoryMap = (data: { usedPercent?: number; usage?: { usedPercent: number; resetAt: number }; resetAt?: number }): SnapshotBody => {
  const used = data.usage?.usedPercent ?? data.usedPercent ?? 0;
  const reset = data.usage?.resetAt ?? data.resetAt ?? 0;
  return { windows: [{ label: 'usage', usedPercent: used, windowMinutes: 0, resetsAt: reset }] };
};
const kimiMap = (data: { balance?: number; usedPercent?: number; kimi_credits?: number }): SnapshotBody => {
  const bal = data.balance ?? data.kimi_credits ?? 0;
  return {
    windows: [{ label: 'credits', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: 0 }],
    balance: bal,
  };
};
const qwenMap = (data: { balance?: number; usedPercent?: number }): SnapshotBody => ({
  windows: [{ label: 'usage', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: 0 }],
  balance: data.balance,
});
const alibabaMap = (data: { balance?: number; usedPercent?: number }): SnapshotBody => ({
  windows: [{ label: 'usage', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: 0 }],
  balance: data.balance,
});
const billingMap = (data: { balance?: number; usedPercent?: number }): SnapshotBody => ({
  windows: [{ label: 'credits', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: 0 }],
  balance: data.balance,
});

// Dual-path (Bearer vs Cookie) and CLI probes stay verbatim as run rows.
async function fetchMistralUsage(auth: ProviderAuth, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const isCookie = auth.token.includes('=') || auth.token.includes(';');
  if (isCookie) {
    const data = await webFetchJson<{ balance?: number; credits?: number; total?: number }>(
      ctx,
      'https://console.mistral.ai/api/billing',
      auth.token,
    );
    const bal = data.balance ?? data.credits ?? 0;
    const total = data.total ?? 100;
    return {
      provider: 'mistral',
      windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - bal) / total) * 100), windowMinutes: 0, resetsAt: 0 }],
      balance: bal,
      raw: data,
    };
  }
  const data = await fetchJson<{ balance: number; total?: number }>(ctx, 'https://api.mistral.ai/v1/balance', {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const total = data.total ?? 100;
  return {
    provider: 'mistral',
    windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }],
    balance: data.balance,
    raw: data,
  };
}

async function fetchPerplexityUsage(auth: ProviderAuth, ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  const isCookie = auth.token.includes('=') || auth.token.includes(';');
  if (!isCookie) {
    const data = await fetchJson<{ balance: number; total?: number }>(ctx, 'https://api.perplexity.ai/balance', {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    const total = data.total ?? 100;
    return {
      provider: 'perplexity',
      windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }],
      balance: data.balance,
      raw: data,
    };
  }
  const data = await webFetchJson<{ recurringCredits?: number; bonusCredits?: number; purchasedCredits?: number; renewalDate?: string }>(
    ctx,
    'https://www.perplexity.ai/api/auth/session',
    auth.token,
  );
  const recurring = data.recurringCredits ?? 0;
  const bonus = data.bonusCredits ?? 0;
  const total = recurring + bonus + (data.purchasedCredits ?? 0);
  const used = total ? Math.min(100, ((total - recurring - bonus) / total) * 100) : 0;
  const balance = recurring + bonus;
  return {
    provider: 'perplexity',
    windows: [{ label: 'credits', usedPercent: used, windowMinutes: 0, resetsAt: data.renewalDate ? Date.parse(data.renewalDate) : 0 }],
    balance,
    raw: data,
  };
}

async function fetchAmpUsage(auth: ProviderAuth, _ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  if (auth.tokenFile) {
    try {
      const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
      const text = bun
        ? await (async () => {
            const f = bun.file(auth.tokenFile!);
            return (await f.exists()) ? f.text() : '';
          })()
        : await readFile(auth.tokenFile, 'utf8').catch(() => '');
      if (text) {
        const used = Number(text.match(/used_percent["\s:]+(\d+(?:\.\d+)?)/i)?.[1] ?? text.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] ?? 0);
        if (used)
          return { provider: 'amp', windows: [{ label: 'usage', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], raw: { text: text.slice(0, 500) } };
      }
    } catch {}
  }
  try {
    const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
    if (!bun) throw new Error('amp: quota file not found');
    const proc = bun.spawn(['amp', 'usage'], { stdout: 'pipe', stderr: 'pipe' });
    const timer = setTimeout(() => {
      try {
        proc.kill();
      } catch {}
    }, 10_000);
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

async function fetchKiroUsage(_auth: ProviderAuth, _ctx: WidgetFetchContext): Promise<UsageSnapshot> {
  try {
    const bun = (globalThis as unknown as { Bun?: typeof Bun }).Bun;
    if (!bun) throw new Error('kiro: quota file not found');
    const proc = bun.spawn(['kiro-cli', 'chat', '--no-interactive', '/usage'], { stdout: 'pipe', stderr: 'pipe' });
    const timer = setTimeout(() => {
      try {
        proc.kill();
      } catch {}
    }, 10_000);
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

export const PROVIDER_TABLE: TableRow[] = [
  {
    id: 'openrouter',
    url: 'https://openrouter.ai/api/v1/key',
    auth: 'bearer',
    map: (data: { data: { credits: { total_credits: number; total_usage: number } } }): SnapshotBody => {
      const c = data.data.credits;
      const used = c.total_credits ? (c.total_usage / c.total_credits) * 100 : 0;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, used), windowMinutes: 0, resetsAt: 0 }],
        balance: c.total_credits - c.total_usage,
      };
    },
  },
  {
    id: 'deepseek',
    url: 'https://api.deepseek.com/user/balance',
    auth: 'bearer',
    map: (data: { balance_infos: { currency: string; total_balance: number; topped_up_balance: number }[] }): SnapshotBody => {
      const usd = data.balance_infos.find((b) => b.currency === 'USD') ?? data.balance_infos[0];
      const bal = usd ? usd.total_balance : 0;
      return { windows: [{ label: 'balance', usedPercent: 0, windowMinutes: 0, resetsAt: 0 }], balance: bal };
    },
  },
  {
    id: 'moonshot',
    url: '{base}/v1/users/me/balance',
    base: 'https://api.moonshot.ai',
    auth: 'bearer',
    map: (data: { data: { available_balance: number } }): SnapshotBody => ({
      windows: [{ label: 'balance', usedPercent: 0, windowMinutes: 0, resetsAt: 0 }],
      balance: data.data.available_balance,
    }),
  },
  {
    id: 'synthetic',
    url: 'https://api.synthetic.new/v1/balance',
    auth: 'bearer',
    map: (data: { balance: number; total: number; used?: number }): SnapshotBody => {
      const total = data.total || data.balance + (data.used ?? 0) || 100;
      const used = data.used ?? total - data.balance;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, (used / total) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: data.balance,
      };
    },
  },
  {
    id: 'deepinfra',
    url: 'https://api.deepinfra.com/billing/checklist',
    auth: 'bearer',
    map: (data: { balance: number; limit?: number; spent?: number }): SnapshotBody => {
      const limit = data.limit ?? 100;
      const spent = data.spent ?? limit - data.balance;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, (spent / limit) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: data.balance,
      };
    },
  },
  {
    id: 'fireworks',
    url: 'https://api.fireworks.ai/billing/summary',
    auth: 'bearer',
    map: (data: { credits: number; usage: number; limit?: number }): SnapshotBody => {
      const limit = data.limit ?? data.credits ?? 100;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, (data.usage / limit) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: (data.credits ?? limit) - data.usage,
      };
    },
  },
  {
    id: 'chutes',
    url: 'https://api.chutes.ai/v1/balance',
    auth: 'bearer',
    map: (data: { balance: number; total?: number; used?: number }): SnapshotBody => {
      const total = data.total ?? 100;
      const used = data.used ?? total - data.balance;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, (used / total) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: data.balance,
      };
    },
  },
  { id: 'groqcloud', url: 'https://api.groq.com/openai/v1/balance', auth: 'bearer', map: groqMap },
  { id: 'groq', url: 'https://api.groq.com/openai/v1/balance', auth: 'bearer', map: groqMap },
  {
    id: 'warp',
    url: 'https://app.warp.dev/api/v1/limits',
    auth: 'bearer',
    map: (data: { remaining: number; total: number }): SnapshotBody => ({
      windows: [
        {
          label: 'requests',
          usedPercent: Math.min(100, ((data.total - data.remaining) / data.total) * 100),
          windowMinutes: 0,
          resetsAt: 0,
        },
      ],
      balance: data.remaining,
    }),
  },
  {
    id: 'codebuff',
    url: 'https://api.codebuff.com/v1/usage',
    auth: 'bearer',
    map: (data: { credits_remaining: number; credits_total: number }): SnapshotBody => ({
      windows: [
        {
          label: 'credits',
          usedPercent: Math.min(100, ((data.credits_total - data.credits_remaining) / data.credits_total) * 100),
          windowMinutes: 0,
          resetsAt: 0,
        },
      ],
      balance: data.credits_remaining,
    }),
  },
  {
    id: 'crof',
    url: 'https://api.crof.ai/v1/billing',
    auth: 'bearer',
    map: (data: { balance: number; limit?: number; used?: number }): SnapshotBody => {
      const limit = data.limit ?? 100;
      const used = data.used ?? limit - data.balance;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, (used / limit) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: data.balance,
      };
    },
  },
  {
    id: 'venice',
    url: 'https://api.venice.ai/api/v1/billing/balance',
    auth: 'bearer',
    map: (data: { balance: number; total?: number }): SnapshotBody => {
      const total = data.total ?? 100;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: data.balance,
      };
    },
  },
  { id: 'cline', url: 'https://api.cline.ai/v1/usage', auth: 'bearer', map: clineMap },
  { id: 'clinepass', url: 'https://api.cline.ai/v1/usage', auth: 'bearer', map: clineMap },
  {
    id: 'llmproxy',
    url: '{base}/v1/balance',
    base: 'https://api.llmproxy.ai',
    auth: 'bearer',
    map: (data: { balance: number; limit?: number }): SnapshotBody => {
      const limit = data.limit ?? 100;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, ((limit - data.balance) / limit) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: data.balance,
      };
    },
  },
  {
    id: 'clawrouter',
    url: 'https://api.clawrouter.ai/v1/balance',
    auth: 'bearer',
    map: (data: { balance: number; total?: number }): SnapshotBody => {
      const total = data.total ?? 100;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: data.balance,
      };
    },
  },
  { id: 'wayfinder', url: 'https://api.wayfinder.ai/v1/usage', auth: 'bearer', map: clineMap },
  {
    id: 'litellm',
    url: '{base}/balance',
    base: 'https://api.litellm.ai',
    auth: 'bearer',
    map: (data: { remaining: number; total: number }): SnapshotBody => ({
      windows: [
        {
          label: 'credits',
          usedPercent: Math.min(100, ((data.total - data.remaining) / data.total) * 100),
          windowMinutes: 0,
          resetsAt: 0,
        },
      ],
      balance: data.remaining,
    }),
  },
  {
    id: 'deepgram',
    url: 'https://api.deepgram.com/v1/projects/balance',
    auth: 'bearer',
    map: (data: { balance: number; limit?: number }): SnapshotBody => {
      const limit = data.limit ?? 100;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, ((limit - data.balance) / limit) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: data.balance,
      };
    },
  },
  {
    id: 'neuralwatt',
    url: 'https://api.neuralwatt.ai/v1/credits',
    auth: 'bearer',
    map: (data: { balance: number; total?: number }): SnapshotBody => {
      const total = data.total ?? 100;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: data.balance,
      };
    },
  },
  {
    id: 'zenmux',
    url: 'https://api.zenmux.ai/v1/balance',
    auth: 'bearer',
    map: (data: { balance: number; limit?: number }): SnapshotBody => {
      const limit = data.limit ?? 100;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, ((limit - data.balance) / limit) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: data.balance,
      };
    },
  },
  {
    id: 'xai',
    url: 'https://api.x.ai/v1/balance',
    auth: 'bearer',
    map: (data: { balance: number; total?: number }): SnapshotBody => {
      const total = data.total ?? 100;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: data.balance,
      };
    },
  },
  {
    id: 'doubao',
    url: 'https://ark.cn-beijing.volces.com/api/v3/balance',
    auth: 'bearer',
    map: (data: { balance: number; total?: number; remaining?: number }): SnapshotBody => {
      const bal = data.balance ?? data.remaining ?? 0;
      const total = data.total ?? 100;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - bal) / total) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: bal,
      };
    },
  },
  {
    id: 'zai',
    url: '{base}/api/paas/v4/balance',
    base: 'https://api.z.ai',
    auth: 'bearer',
    map: (data: { balance: number; total?: number }): SnapshotBody => {
      const total = data.total ?? 100;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: data.balance,
      };
    },
  },
  {
    id: 'kilo',
    url: 'https://api.kilo.ai/v1/balance',
    auth: 'bearer',
    map: (data: { balance: number; total?: number }): SnapshotBody => {
      const total = data.total ?? 100;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: data.balance,
      };
    },
  },
  {
    id: 'kilocode',
    url: 'https://api.kilocode.ai/v1/balance',
    auth: 'bearer',
    map: (data: { balance: number; total?: number }): SnapshotBody => {
      const total = data.total ?? 100;
      return {
        windows: [{ label: 'credits', usedPercent: Math.min(100, ((total - data.balance) / total) * 100), windowMinutes: 0, resetsAt: 0 }],
        balance: data.balance,
      };
    },
  },
  { id: 'mistral', run: fetchMistralUsage },
  { id: 'perplexity', run: fetchPerplexityUsage },
  {
    id: 'cursor',
    url: 'https://cursor.sh/api/dashboard/usage',
    auth: 'cookie',
    map: (data: { usage?: { usedPercent: number; resetAt: number }; usedPercent?: number; resetAt?: number }): SnapshotBody => {
      const used = data.usage?.usedPercent ?? data.usedPercent ?? 0;
      const reset = data.usage?.resetAt ?? data.resetAt ?? 0;
      return { windows: [{ label: 'usage', usedPercent: used, windowMinutes: 0, resetsAt: reset }] };
    },
  },
  { id: 'factory', url: 'https://app.factory.ai/api/usage', auth: 'cookie', map: factoryMap },
  { id: 'droid', url: 'https://app.factory.ai/api/usage', auth: 'cookie', map: factoryMap },
  {
    id: 'sakana',
    url: 'https://console.sakana.ai/api/billing',
    auth: 'cookie',
    map: (data: { balance?: number; credits?: number; usedPercent?: number }): SnapshotBody => {
      const bal = data.balance ?? data.credits ?? 0;
      const used = data.usedPercent ?? (bal ? 0 : 0);
      return { windows: [{ label: 'credits', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], balance: bal };
    },
  },
  {
    id: 'abacus',
    url: 'https://api.abacus.ai/api/billing',
    auth: 'cookie',
    map: (data: { balance?: number; usedPercent?: number; credits?: number }): SnapshotBody => {
      const bal = data.balance ?? data.credits ?? 0;
      const used = data.usedPercent ?? 0;
      return { windows: [{ label: 'credits', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], balance: bal };
    },
  },
  {
    id: 'notion',
    url: 'https://app.notion.com/api/v3/getCreditRateLimitStatus',
    auth: 'cookie',
    map: (data: {
      credits?: number;
      usedPercent?: number;
      sixHour?: { usedPercent: number; resetsAt: number };
      monthly?: { usedPercent: number; resetsAt: number };
    }): SnapshotBody => {
      const windows: RateWindow[] = [];
      if (data.sixHour) windows.push({ label: '6h', usedPercent: data.sixHour.usedPercent, windowMinutes: 360, resetsAt: data.sixHour.resetsAt });
      if (data.monthly)
        windows.push({ label: 'monthly', usedPercent: data.monthly.usedPercent, windowMinutes: 43200, resetsAt: data.monthly.resetsAt });
      if (!windows.length) windows.push({ label: 'credits', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: 0 });
      return { windows, balance: data.credits };
    },
  },
  {
    id: 't3chat',
    url: 'https://t3.chat/api/trpc/getCustomerData',
    auth: 'cookie',
    map: (data: {
      base?: { usedPercent: number; resetsAt: number };
      overage?: { usedPercent: number; resetsAt: number };
      usedPercent?: number;
      resetsAt?: number;
    }): SnapshotBody => {
      const windows: RateWindow[] = [];
      if (data.base) windows.push({ label: 'base', usedPercent: data.base.usedPercent, windowMinutes: 240, resetsAt: data.base.resetsAt });
      if (data.overage)
        windows.push({ label: 'overage', usedPercent: data.overage.usedPercent, windowMinutes: 43200, resetsAt: data.overage.resetsAt });
      if (!windows.length) windows.push({ label: 'usage', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: data.resetsAt ?? 0 });
      return { windows };
    },
  },
  { id: 'alibaba', url: 'https://coding.alibabacloud.com/api/billing', auth: 'cookie', map: alibabaMap },
  { id: 'alibaba-coding-plan', url: 'https://coding.alibabacloud.com/api/billing', auth: 'cookie', map: alibabaMap },
  { id: 'alibaba-token-plan', url: 'https://coding.alibabacloud.com/api/billing', auth: 'cookie', map: alibabaMap },
  { id: 'qwen', url: 'https://dashscope.aliyuncs.com/api/v1/billing', auth: 'cookie', map: qwenMap },
  { id: 'qwen-cloud', url: 'https://dashscope.aliyuncs.com/api/v1/billing', auth: 'cookie', map: qwenMap },
  { id: 'manus', url: 'https://manus.im/api/billing', auth: 'cookie', map: billingMap },
  { id: 'minimax', url: 'https://platform.minimax.io/api/billing', auth: 'cookie', map: billingMap },
  { id: 'kimi', url: 'https://www.kimi.com/api/billing', auth: 'cookie', map: kimiMap },
  { id: 'kimi-web', url: 'https://www.kimi.com/api/billing', auth: 'cookie', map: kimiMap },
  { id: 'commandcode', url: 'https://commandcode.ai/api/billing', auth: 'cookie', map: billingMap },
  { id: 'devin', url: 'https://app.devin.ai/api/billing', auth: 'cookie', map: billingMap },
  { id: 'xiaomi-mimo', url: 'https://mimo.chat/api/billing', auth: 'cookie', map: billingMap },
  { id: 'windsurf', url: 'https://windsurf.com/api/billing', auth: 'cookie', map: billingMap },
  {
    id: 'openai-web',
    url: 'https://chatgpt.com/backend-api/usage',
    auth: 'cookie',
    map: (data: { usedPercent?: number; resetsAt?: number; balance?: number }): SnapshotBody => ({
      windows: [{ label: 'usage', usedPercent: data.usedPercent ?? 0, windowMinutes: 0, resetsAt: data.resetsAt ?? 0 }],
      balance: data.balance,
    }),
  },
  {
    id: 'claude-web',
    url: 'https://claude.ai/api/organizations/usage',
    auth: 'cookie',
    map: (data: { usedPercent?: number; resetsAt?: number; five_hour?: { utilization: number; reset_at: string } }): SnapshotBody => {
      const used = data.five_hour?.utilization ?? data.usedPercent ?? 0;
      const resetsAt = data.five_hour?.reset_at ? Date.parse(data.five_hour.reset_at) : (data.resetsAt ?? 0);
      return { windows: [{ label: 'five_hour', usedPercent: used, windowMinutes: 300, resetsAt }] };
    },
  },
  {
    id: 'jetbrains',
    auth: 'file',
    missing: 'jetbrains: quota file not found — set tokenFile to AIAssistantQuotaManager2.xml path',
    map: (xml: string): SnapshotBody => {
      const used = Number(xml.match(/used="(\d+(?:\.\d+)?)"/)?.[1] ?? xml.match(/usedPercent="(\d+(?:\.\d+)?)"/)?.[1] ?? 0);
      const total = Number(xml.match(/total="(\d+(?:\.\d+)?)"/)?.[1] ?? 100);
      const pct = total ? Math.min(100, (used / total) * 100) : used;
      return { windows: [{ label: 'monthly', usedPercent: pct, windowMinutes: 0, resetsAt: 0 }], raw: { xml: xml.slice(0, 200) } };
    },
  },
  {
    id: 'zed',
    url: 'https://cloud.zed.dev/client/users/me',
    auth: 'bearer',
    headers: { Accept: 'application/json' },
    missing: 'zed: quota file not found — set token or tokenFile to Zed credentials',
    map: (data: Record<string, unknown>): SnapshotBody => {
      const used = Number((data.used_percent as number) ?? (data.usedPercent as number) ?? 0);
      const plan = (data.plan as string) ?? (data.subscription as string);
      return { windows: [{ label: 'usage', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], plan };
    },
  },
  {
    id: 'antigravity',
    url: '{base}/RetrieveUserQuotaSummary',
    base: 'https://localhost:8765',
    auth: 'bearer',
    headers: { 'Content-Type': 'application/json' },
    optionalToken: true,
    fetchFail: 'antigravity: quota file not found — set quotaUrl or install agy CLI',
    map: (data: { used_percent?: number; usedPercent?: number; plan?: string; quota?: { usedPercent?: number } }): SnapshotBody => {
      const used = Number(data.quota?.usedPercent ?? data.used_percent ?? data.usedPercent ?? 0);
      return { windows: [{ label: 'quota', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], plan: data.plan };
    },
  },
  {
    id: 'augment',
    url: '{base}/v1/usage',
    base: 'https://api.augmentcode.com',
    auth: 'bearer',
    missing: 'augment: quota file not found — set token or tokenFile',
    map: (data: { used_percent?: number; usedPercent?: number; plan?: string }): SnapshotBody => {
      const used = Number(data.used_percent ?? data.usedPercent ?? 0);
      return { windows: [{ label: 'usage', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], plan: data.plan };
    },
  },
  { id: 'amp', run: fetchAmpUsage },
  {
    id: 'ollama',
    url: '{base}/api/tags',
    base: 'http://localhost:11434',
    auth: 'none',
    headers: { Accept: 'application/json' },
    fetchFail: 'ollama: quota file not found — set quotaUrl to running Ollama host',
    map: (data: { models?: unknown[]; quota?: { usedPercent?: number } }): SnapshotBody => {
      const used = Number(data.quota?.usedPercent ?? 0);
      return { windows: [{ label: 'local', usedPercent: used, windowMinutes: 0, resetsAt: 0 }] };
    },
  },
  {
    id: 'bedrock',
    url: '{base}/quota',
    base: 'https://bedrock-runtime.amazonaws.com',
    auth: 'bearer',
    missing: 'bedrock: quota file not found — set token or tokenFile',
    map: (data: { used_percent?: number; usedPercent?: number }): SnapshotBody => {
      const used = Number(data.used_percent ?? data.usedPercent ?? 0);
      return { windows: [{ label: 'quota', usedPercent: used, windowMinutes: 0, resetsAt: 0 }] };
    },
  },
  {
    id: 'stepfun',
    url: '{base}/v1/balance',
    base: 'https://api.stepfun.com',
    auth: 'bearer',
    missing: 'stepfun: quota file not found — set token or tokenFile',
    map: (data: { used_percent?: number; usedPercent?: number; balance?: number }): SnapshotBody => {
      const used = Number(data.used_percent ?? data.usedPercent ?? 0);
      return { windows: [{ label: 'quota', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], balance: data.balance };
    },
  },
  { id: 'kiro', run: fetchKiroUsage },
];
