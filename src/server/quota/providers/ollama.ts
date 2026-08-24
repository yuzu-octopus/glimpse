import { fetchJson } from '../../widgets/http';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// token: unused (local); quotaUrl/baseUrl: Ollama host override (default http://localhost:11434)
export async function fetchOllamaUsage(
  auth: { token: string; tokenFile?: string; baseUrl?: string; quotaUrl?: string },
  ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  void auth.token; void auth.tokenFile;
  const base = auth.quotaUrl ?? auth.baseUrl ?? 'http://localhost:11434';
  try {
    const data = await fetchJson<{ models?: unknown[]; quota?: { usedPercent?: number } }>(ctx, `${base}/api/tags`, {
      headers: { Accept: 'application/json' },
    });
    // Ollama local has no quota — report 0% as available
    const used = Number((data.quota as { usedPercent?: number } | undefined)?.usedPercent ?? 0);
    return { provider: 'ollama', windows: [{ label: 'local', usedPercent: used, windowMinutes: 0, resetsAt: 0 }], raw: data };
  } catch {
    throw new Error('ollama: quota file not found — set quotaUrl to running Ollama host');
  }
}
