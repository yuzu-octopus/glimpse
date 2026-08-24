import { readFile } from 'node:fs/promises';
import type { WidgetFetchContext } from '../../widgets/registry';
import type { UsageSnapshot } from '../../../shared/widgets/quota-types';

// tokenFile: JetBrains AIAssistantQuotaManager2.xml — e.g. ~/.config/JetBrains/*/options/AIAssistantQuotaManager2.xml
// token: unused (file only); quotaUrl not used
export async function fetchJetbrainsUsage(
  auth: { token: string; tokenFile?: string },
  _ctx: WidgetFetchContext,
): Promise<UsageSnapshot> {
  const path = auth.tokenFile ?? '';
  if (!path) throw new Error('jetbrains: quota file not found — set tokenFile to AIAssistantQuotaManager2.xml path');
  let xml: string;
  try {
    const bun = (globalThis as unknown as { Bun?: { file: (p: string) => { exists(): Promise<boolean>; text(): Promise<string> } } }).Bun;
    if (bun) {
      const f = bun.file(path);
      if (!(await f.exists())) throw new Error('jetbrains: quota file not found');
      xml = await f.text();
    } else {
      xml = await readFile(path, 'utf8');
    }
  } catch {
    throw new Error('jetbrains: quota file not found');
  }
  const used = Number(xml.match(/used="(\d+(?:\.\d+)?)"/)?.[1] ?? xml.match(/usedPercent="(\d+(?:\.\d+)?)"/)?.[1] ?? 0);
  const total = Number(xml.match(/total="(\d+(?:\.\d+)?)"/)?.[1] ?? 100);
  const pct = total ? Math.min(100, (used / total) * 100) : used;
  return { provider: 'jetbrains', windows: [{ label: 'monthly', usedPercent: pct, windowMinutes: 0, resetsAt: 0 }], raw: { xml: xml.slice(0, 200) } };
}
